import { readGuideSource } from "./guides-fetch";
import type { GameSummary } from "./types";

export const ROM_DOWNLOAD_CHART_URL = "https://romhackplaza.org/database?types%5B0%5D=romhacks&sort=total_downloads&dir=desc";
export type RomCommunityEntry = { title: string; url: string; image: string; platform: string; author: string; downloads: number };
export type RomDownloadPage = { entries: RomCommunityEntry[]; nextPage: number | null };
/** Preserve the source's exact hack identity, without guessing an IGDB match. */
export function romCommunityGame(entry: RomCommunityEntry, description = ""): GameSummary {
  const page = sourceUrl(entry.url);
  if (!page) throw Error("Invalid ROM hack page");
  return { id: `source:romhackplaza:${new URL(page).pathname.slice(1)}`, name: entry.title, capsule: entry.image, portrait: entry.image, platforms: [entry.platform], gameType: 5,
    sourceListing: { page, sourceName: "Romhack Plaza", description, screenshots: [] } };
}
const text = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
function sourceUrl(raw: string, image = false) {
  try {
    const url = new URL(raw, ROM_DOWNLOAD_CHART_URL);
    return url.origin === "https://romhackplaza.org" && !url.username && !url.password && url.pathname.startsWith(image ? "/storage/" : "/romhacks/") ? url.href : "";
  } catch { return ""; }
}
/** Parse only attributed source records. Provider markup/scripts never render. */
export function parseRomDownloads(html: string): RomCommunityEntry[] {
  const root = new DOMParser().parseFromString(html, "text/html");
  return parseEntries(root);
}
function parseEntries(root: Document): RomCommunityEntry[] {
  const selectedSort = root.querySelector('.database-sort button.active');
  if (!selectedSort?.getAttribute("wire:click")?.includes("total_downloads")) throw Error("Download ranking unavailable");
  const seen = new Set<string>();
  const entries = [...root.querySelectorAll(".entry-card")].flatMap(card => {
    const link = card.querySelector(".entry-card-title"), url = sourceUrl(link?.getAttribute("href") ?? ""), title = text(link);
    const raw = text(card.querySelector('[data-lucide="download"]')?.parentElement ?? null).replaceAll(",", "");
    const downloads = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!url || !title || seen.has(url) || !Number.isSafeInteger(downloads) || downloads < 0) return [];
    seen.add(url);
    return [{ title: title.slice(0, 240), url, downloads, image: sourceUrl(card.querySelector(".entry-cover-wrapper img")?.getAttribute("src") ?? "", true), platform: text(card.querySelector(".entry-badge")).slice(0, 100), author: text(card.querySelector(".entry-card-author")).replace(/^By\s+/i, "").slice(0, 160) }];
  });
  if (!entries.length || entries.some((entry, index) => index > 0 && entry.downloads > entries[index - 1].downloads)) throw Error("Download ranking unavailable");
  return entries;
}
export function romDownloadPageUrl(page = 1) {
  if (!Number.isSafeInteger(page) || page < 1) throw Error("Invalid download chart page");
  const url = new URL(ROM_DOWNLOAD_CHART_URL);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.href;
}
export function parseRomDownloadPage(html: string, page = 1): RomDownloadPage {
  romDownloadPageUrl(page);
  const root = new DOMParser().parseFromString(html, "text/html");
  const buttons = [...root.querySelectorAll("button")];
  const selected = buttons.find(button => button.classList.contains("active") && /^gotoPage\(\d+\)$/.test(button.getAttribute("wire:click") ?? ""));
  const selectedPage = Number(selected?.getAttribute("wire:click")?.match(/\d+/)?.[0] ?? 1);
  // A provider ignoring the page parameter must never repeat page one's ranks.
  if (selectedPage !== page) throw Error("Download chart page unavailable");
  const next = buttons.some(button => button.getAttribute("wire:click") === "nextPage" && !button.disabled);
  return { entries: parseEntries(root), nextPage: next ? page + 1 : null };
}
export function loadRomDownloads(signal: AbortSignal, page = 1) {
  return readGuideSource(romDownloadPageUrl(page), signal, html => parseRomDownloadPage(html, page), 30 * 60_000);
}
