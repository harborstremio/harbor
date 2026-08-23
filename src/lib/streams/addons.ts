import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Addon } from "@/lib/addons";
import { dlog, dwarn } from "@/lib/debug";
import { isAddonRanked, isStatusOnlyAddon } from "./addon-detect";
import type { AddonRankFn } from "./addon-priority";
import { hasUncachedMarker } from "./cached";
import { infoHashFromSources, infoHashFromUrl } from "@/lib/torrent/magnet";
import type { Stream } from "./types";

const TIMEOUT_MS_FAST = 8000;
const TIMEOUT_MS_SLOW = 22000;
const SLOW_ADDON_PATTERNS = [
  /mediafusion/i,
  /comet/i,
  /torrentio/i,
  /knightcrawler/i,
  /aiostreams/i,
  /jackettio/i,
  /torbox/i,
];

function timeoutFor(addon: Addon, ceilingMs: number): number {
  const name = addon.manifest.name ?? "";
  const id = addon.manifest.id ?? "";
  const url = addon.transportUrl ?? "";
  const slow = SLOW_ADDON_PATTERNS.some((re) => re.test(name) || re.test(id) || re.test(url));
  const base = slow ? TIMEOUT_MS_SLOW : TIMEOUT_MS_FAST;
  return Math.max(base, ceilingMs);
}

export type StreamRequest = {
  type: string;
  ids: string[];
};

export async function fetchAddonStreams(
  addons: Addon[],
  req: StreamRequest,
  signal: AbortSignal,
  onPartial?: (current: Stream[]) => void,
  onProgress?: (settled: number, total: number) => void,
  timeoutMs = TIMEOUT_MS_SLOW,
  ranks?: AddonRankFn | null,
): Promise<Stream[]> {
  const namedTasks: Array<{ name: string; p: Promise<Stream[]> }> = [];
  const skipped: string[] = [];
  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i];
    const priority = ranks ? ranks(i, addon) : i;
    if (isStatusOnlyAddon(addon)) {
      skipped.push(`${addon.manifest.name}(status-addon)`);
      continue;
    }
    const ids = pickIds(addon, req.type, req.ids);
    if (ids.length === 0) {
      skipped.push(`${addon.manifest.name}(no-matching-id)`);
      continue;
    }
    for (const id of ids) {
      namedTasks.push({
        name: addon.manifest.name,
        p: fetchOne(addon, req.type, id, signal, timeoutMs).then((ss) =>
          ss.map((s, idx) => ({ ...s, addonPriority: priority, addonReturnIdx: idx })),
        ),
      });
    }
  }
  if (skipped.length > 0) console.info(`[addons] skipped: ${skipped.join(", ")}`);
  console.info(`[addons] querying ${namedTasks.length}: ${namedTasks.map((t) => t.name).join(", ")}`);

  const total = namedTasks.length;
  onProgress?.(0, total);
  let settled = 0;
  const accumulated: Stream[] = [];
  const wrapped = namedTasks.map(({ name, p }) =>
    p
      .then((streams) => {
        console.info(`[addons] ${name}: ${streams.length} streams`);
        accumulated.push(...streams);
        if (onPartial) onPartial(accumulated.slice());
      })
      .catch((e) => {
        if (!signal.aborted) dwarn(`[addons] ${name} failed`, e);
      })
      .finally(() => onProgress?.(++settled, total)),
  );

  await Promise.allSettled(wrapped);
  return dedupeStreams(accumulated);
}

export function addonSupportsStream(addon: Addon, req: StreamRequest): boolean {
  return pickId(addon, req.type, req.ids) != null;
}

const PREFIX_PRIORITY = ["kitsu", "mal", "anidb", "anilist", "tt", "tmdb"];

function idPriority(id: string): number {
  for (let i = 0; i < PREFIX_PRIORITY.length; i++) {
    if (id.startsWith(PREFIX_PRIORITY[i])) return i;
  }
  return 999;
}

function pickId(addon: Addon, type: string, ids: string[]): string | null {
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  for (const id of sorted) {
    if (addonAcceptsId(addon, type, id)) return id;
  }
  return null;
}

function pickIds(addon: Addon, type: string, ids: string[]): string[] {
  // Exactly one request per addon: dual-capable manifests used to be queried under both
  // the anime id and its IMDb twin, doubling network load and returning near-duplicate
  // streams. PREFIX_PRIORITY already ranks anime schemes above tt/tmdb, so anime metas
  // resolve to their kitsu/mal id and everything else falls through to tt/tmdb.
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  const accepted = sorted.filter((id) => addonAcceptsId(addon, type, id));
  return accepted.length > 0 ? [accepted[0]] : [];
}

function addonAcceptsId(addon: Addon, type: string, id: string): boolean {
  const m = addon.manifest;
  const resources = m.resources ?? [];
  const streamResources = resources.filter(
    (r): r is { name: string; types?: string[]; idPrefixes?: string[] } =>
      typeof r === "object" && r.name === "stream",
  );
  if (streamResources.length > 0) {
    return streamResources.some((r) => {
      const typeOk = Array.isArray(r.types) && r.types.includes(type);
      const idOk =
        !r.idPrefixes ||
        r.idPrefixes.length === 0 ||
        r.idPrefixes.some((p) => id.startsWith(p));
      return typeOk && idOk;
    });
  }
  if (!resources.some((r) => r === "stream")) return false;
  if (!m.types || !m.types.includes(type)) return false;
  if (m.idPrefixes && m.idPrefixes.length > 0 && !m.idPrefixes.some((p) => id.startsWith(p))) {
    return false;
  }
  return true;
}

async function fetchOne(
  addon: Addon,
  type: string,
  id: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Stream[]> {
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  const url = `${base}/stream/${type}/${id}.json`;
  const limit = timeoutFor(addon, timeoutMs);
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, limit);
  const onParentAbort = () => ac.abort();
  signal.addEventListener("abort", onParentAbort);
  const startedAt = performance.now();
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
      signal: ac.signal,
    });
    if (!res.ok) {
      dwarn(`[addons] ${addon.manifest.name} returned ${res.status} for ${type}/${id}`);
      return [];
    }
    const json = (await res.json()) as { streams?: RawStream[] };
    const list = json.streams ?? [];
    const ranked = isAddonRanked(addon);
    return list.map((s) => {
      const mapped = {
        ...s,
        infoHash: s.infoHash?.toLowerCase(),
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
        addonUrl: addon.transportUrl,
        addonRanked: ranked,
      };
      if (!mapped.infoHash && hasUncachedMarker(s)) {
        const fromUrl = s.url ? infoHashFromUrl(s.url) : null;
        const hash = fromUrl?.infoHash ?? infoHashFromSources(s.sources);
        if (hash) {
          mapped.infoHash = hash;
          if (mapped.fileIdx == null && fromUrl?.fileIdx != null) mapped.fileIdx = fromUrl.fileIdx;
        }
      }
      return mapped;
    });
  } catch (e) {
    if (timedOut) {
      dwarn(`[addons] ${addon.manifest.name} timed out after ${limit}ms — dropped`);
    } else if (!signal.aborted) {
      dwarn(`[addons] ${addon.manifest.name} failed`, e);
    }
    return [];
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
    const elapsed = Math.round(performance.now() - startedAt);
    if (elapsed > 2500 && !timedOut) {
      dlog(`[addons] ${addon.manifest.name} took ${elapsed}ms`);
    }
  }
}

function dedupeStreams(streams: Stream[]): Stream[] {
  const byHash = new Map<string, Stream>();
  const byIdent = new Map<string, Stream>();
  const kept: Stream[] = [];
  let dropped = 0;
  const normTitle = (s: Stream) =>
    `${(s.title ?? s.name ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`;
  for (const s of streams) {
    if (!s.infoHash) {
      const fromUrl = s.url ? infoHashFromUrl(s.url) : null;
      const recovered = fromUrl?.infoHash ?? infoHashFromSources(s.sources);
      if (recovered) {
        s.infoHash = recovered.toLowerCase();
        if (s.fileIdx == null && fromUrl?.fileIdx != null) s.fileIdx = fromUrl.fileIdx;
      }
    }
    const hk = s.infoHash ? `h:${s.infoHash}:${s.fileIdx ?? ""}` : null;
    const title = normTitle(s);
    const nk = title ? `n:${title}|${s.behaviorHints?.videoSize ?? ""}` : null;
    const existing = (hk ? byHash.get(hk) : undefined) ?? (nk ? byIdent.get(nk) : undefined);
    if (existing) {
      dropped += 1;
      if (dropped <= 3) {
        console.info(
          `[addons] dedupe drop #${dropped}: ${s.addonName} twin of ${existing.addonName} "${title}" [${hk ? "hash" : "name"}]`,
        );
      }
      if (hk && !existing.infoHash) {
        existing.infoHash = s.infoHash;
        existing.fileIdx = s.fileIdx;
      }
      if (s.sources && s.sources.length > 0) {
        const merged = new Set([...(existing.sources ?? []), ...s.sources]);
        existing.sources = [...merged];
      }
      continue;
    }
    if (hk) byHash.set(hk, s);
    if (nk) byIdent.set(nk, s);
    kept.push(s);
  }
  console.info(`[addons] dedupe: kept=${kept.length}, dropped=${dropped} (cross-addon twins)`);
  return kept;
}

type RawStream = Omit<Stream, "addonId" | "addonName">;
