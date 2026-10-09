import { safeFetchBytes } from "@/lib/safe-fetch";
import { searchTyped } from "./catalog";
import { resolveArtist } from "./artist-authority";
import { BILLBOARD_CHARTS, type BillboardChartRef } from "./billboard-directory";
import type { MusicDiscoveryChart } from "./discovery";
import type { MusicCatalogItem } from "./types";
export { BILLBOARD_CHARTS } from "./billboard-directory";
export const BILLBOARD_HOT_100_URL = "https://www.billboard.com/charts/hot-100/";
export type BillboardRanking = {
  chartId: string;
  date: string;
  entries: { rank: number; item: MusicCatalogItem }[];
};
export type MusicBillboardChart = MusicDiscoveryChart & { date: string };
const MAX_PAGE_BYTES = 8 * 1024 * 1024;
const cache = new Map<string, { until: number; chart: BillboardRanking }>();
let hotPending: Promise<MusicBillboardChart> | null = null;
const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
const identity = (value: string) =>
  value
    .replace(/[™®]/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export const billboardChartUrl = (id: string) => `https://www.billboard.com/charts/${id}/`;
export function parseBillboardChart(html: string, chart: BillboardChartRef): BillboardRanking {
  if (html.length > MAX_PAGE_BYTES) throw new Error("Billboard page is too large");
  const document = new DOMParser().parseFromString(html, "text/html");
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (canonical) {
    const url = new URL(canonical);
    if (url.hostname !== "www.billboard.com" || url.pathname.split("/")[2] !== chart.id)
      throw new Error("Billboard chart identity does not match");
  } else if (identity(text(document.querySelector("h1"))) !== identity(chart.name))
    throw new Error("Billboard chart identity is unavailable");
  const dateLabel = [...document.querySelectorAll("h2")]
    .map(text)
    .find((value) => /^Week of [A-Za-z]+ \d{1,2}, \d{4}$/.test(value));
  const timestamp = Date.parse(dateLabel?.replace(/^Week of /, "") ?? "");
  if (!Number.isFinite(timestamp)) throw new Error("Billboard chart date is unavailable");
  const d = new Date(timestamp);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const entries: BillboardRanking["entries"] = [];
  const seen = new Set<number>();
  for (const row of document.querySelectorAll(
    ".o-chart-results-list-row-container > .o-chart-results-list-row",
  )) {
    const rank = Number(text(row.querySelector(":scope > li:first-child > .c-label")));
    const titleNode = row.querySelector("h3#title-of-a-story");
    const title = text(titleNode);
    const artist = text(titleNode?.nextElementSibling ?? null);
    if (
      !Number.isSafeInteger(rank) ||
      rank < 1 ||
      rank > 200 ||
      seen.has(rank) ||
      !title ||
      (chart.kind !== "artist" && !artist)
    )
      continue;
    let artwork = "";
    const image = row.querySelector("img");
    const raw =
      image?.getAttribute("data-lazy-src") ??
      image?.getAttribute("data-src") ??
      image?.getAttribute("src") ??
      "";
    try {
      const url = new URL(raw);
      if (
        url.protocol === "https:" &&
        ["charts-static.billboard.com", "www.billboard.com"].includes(url.hostname)
      )
        artwork = url.href;
    } catch {
      /* Optional provider artwork. */
    }
    const base = { id: `billboard:${chart.id}:${date}:${rank}`, connectorId: "catalog", artwork };
    const item: MusicCatalogItem =
      chart.kind === "artist"
        ? { ...base, kind: "artist", name: title }
        : chart.kind === "album"
          ? { ...base, kind: "album", title, artist }
          : { ...base, kind: "track", title, artist, durationSeconds: 0, durationLabel: "" };
    entries.push({ rank, item });
    seen.add(rank);
  }
  entries.sort((a, b) => a.rank - b.rank);
  if (!entries.length || entries[0].rank !== 1)
    throw new Error("Billboard chart entries are unavailable");
  return { chartId: chart.id, date, entries };
}
export function parseBillboardHot100(html: string): MusicBillboardChart {
  const parsed = parseBillboardChart(
    html,
    BILLBOARD_CHARTS.find((chart) => chart.id === "hot-100")!,
  );
  return {
    date: parsed.date,
    tracks: parsed.entries
      .map((entry) => entry.item)
      .filter(
        (item): item is Extract<MusicCatalogItem, { kind: "track" }> => item.kind === "track",
      ),
    positions: parsed.entries.map((entry) => entry.rank),
    artists: [],
  };
}
async function readPage(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Billboard page is empty");
  const decoder = new TextDecoder();
  let size = 0;
  let html = "";
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.byteLength;
      if (size > MAX_PAGE_BYTES) throw new Error("Billboard page is too large");
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function loadBillboardChart(
  id: string,
  signal?: AbortSignal,
  refresh = false,
): Promise<BillboardRanking> {
  const chart = BILLBOARD_CHARTS.find((chart) => chart.id === id);
  if (!chart) throw new Error("Unknown Billboard chart");
  signal?.throwIfAborted();
  const saved = cache.get(id);
  if (!refresh && saved && saved.until > Date.now()) return saved.chart;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const response = await safeFetchBytes(
      billboardChartUrl(id),
      { signal: controller.signal, credentials: "omit" },
      15000,
      MAX_PAGE_BYTES,
    );
    if (!response.ok) throw new Error(`Billboard: ${response.status}`);
    const parsed = parseBillboardChart(await readPage(response, controller.signal), chart);
    controller.signal.throwIfAborted();
    cache.set(id, { until: Date.now() + 60 * 60 * 1000, chart: parsed });
    while (cache.size > 16) cache.delete(cache.keys().next().value!);
    return parsed;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export function loadBillboardHot100(): Promise<MusicBillboardChart> {
  if (hotPending) return hotPending;
  hotPending = loadBillboardChart("hot-100")
    .then((chart) => ({
      date: chart.date,
      tracks: chart.entries
        .map((entry) => entry.item)
        .filter(
          (item): item is Extract<MusicCatalogItem, { kind: "track" }> => item.kind === "track",
        ),
      positions: chart.entries.map((entry) => entry.rank),
      artists: [],
    }))
    .finally(() => {
      hotPending = null;
    });
  return hotPending;
}
/** Chart IDs are not catalog IDs. Resolve album/artist entries only on an exact match. */
export async function resolveBillboardItem(
  item: MusicCatalogItem,
): Promise<MusicCatalogItem | null> {
  if (item.kind === "track") return item;
  if (item.kind === "artist") {
    const canonical = (await resolveArtist(item.name)).canonical;
    return canonical ? { ...canonical, kind: "artist" } : null;
  }
  if (item.kind !== "album") return null;
  const result = await searchTyped(`${item.title} ${item.artist}`, 32, "catalog");
  const match = result.albums.filter(
    (album) =>
      identity(album.title) === identity(item.title) &&
      identity(album.artist) === identity(item.artist),
  );
  return match.length === 1 ? { ...match[0], kind: "album" } : null;
}
