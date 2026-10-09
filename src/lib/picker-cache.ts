import { lruSet } from "./cache";
import type { Meta } from "./cinemeta";
import { registerEvictable } from "./maintenance";
import type { PipelineResult } from "./streams/pipeline";
import type { PlayEpisode } from "./view";

const MAX_ENTRIES = 80;
const STALE_MS = 30 * 60 * 1000;

type StoredResult = Omit<PipelineResult, "raw">;

type Entry = {
  meta: Meta;
  episode?: PlayEpisode;
  result: StoredResult;
  fetchedAt: number;
  configHash: string;
  complete: boolean;
};

try {
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("harbor.picker-cache.")) stale.push(k);
  }
  for (const k of stale) localStorage.removeItem(k);
} catch {}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function entryKey(meta: Meta, episode?: PlayEpisode): string {
  if (!episode) return meta.id;
  const base = `${meta.id}|s${episode.season}e${episode.episode}`;
  const anime = /^(kitsu|mal|anilist|anidb):/.test(meta.id) || episode.kitsuStreamId != null;
  if (!anime) return base;
  const disc =
    episode.videoId ??
    episode.kitsuStreamId ??
    (episode.imdbSeason != null && episode.imdbEpisode != null
      ? `${episode.imdbSeason}:${episode.imdbEpisode}`
      : null);
  return disc ? `${base}|${disc}` : base;
}

function notify() {
  listeners.forEach((l) => l());
}

export function setPickerCache(
  meta: Meta,
  episode: PlayEpisode | undefined,
  result: PipelineResult,
  configHash: string,
  complete = true,
): void {
  if (result.picker.all.length === 0) return;
  const stripped: StoredResult = { picker: result.picker, rejected: result.rejected.slice(0, 60), debridErrors: result.debridErrors };
  lruSet(cache, entryKey(meta, episode), {
    meta,
    episode,
    result: stripped,
    fetchedAt: Date.now(),
    configHash,
    complete,
  }, MAX_ENTRIES);
  notify();
}

// Keys for the actively-playing item(s). Pinned entries are exempt from
// eviction so "Switch stream" always finds their streams in-place instead of
// bouncing the user out to the full picker (which stops playback) once the
// 30-min stale sweep runs. See pin/unpin below + use-stream-switcher.
const pinned = new Set<string>();

export function pinPickerCache(meta: Meta, episode?: PlayEpisode): void {
  pinned.add(entryKey(meta, episode));
}

export function unpinPickerCache(meta: Meta, episode?: PlayEpisode): void {
  pinned.delete(entryKey(meta, episode));
}

registerEvictable("picker-cache", (aggressive) => {
  const now = Date.now();
  let changed = false;
  for (const [k, e] of cache) {
    if (pinned.has(k)) continue;
    if (aggressive || now - e.fetchedAt > STALE_MS) {
      cache.delete(k);
      changed = true;
    }
  }
  if (changed) notify();
});

export function getPickerCache(
  meta: Meta,
  episode: PlayEpisode | undefined,
  configHash: string,
): Entry | null {
  const key = entryKey(meta, episode);
  const e = cache.get(key);
  if (!e) return null;
  if (e.configHash !== configHash) {
    cache.delete(key);
    return null;
  }
  return e;
}

export function peekPickerCache(meta: Meta, episode?: PlayEpisode): Entry | null {
  return cache.get(entryKey(meta, episode)) ?? null;
}

export function clearPickerCache(): void {
  cache.clear();
  notify();
}

export function clearOnePickerCache(meta: Meta, episode?: PlayEpisode): void {
  if (cache.delete(entryKey(meta, episode))) notify();
}

export function subscribePickerCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function pickerCacheCount(): number {
  return cache.size;
}

export function pickerCacheMatches(meta: Meta, episode?: PlayEpisode): boolean {
  return cache.has(entryKey(meta, episode));
}

// Bumped whenever trust filter / parser / scoring logic changes in a way that
// would re-classify existing cached results. Existing cache entries hash with
// older versions and will fail equality on the next read → forced re-fetch.
const TRUST_LOGIC_VERSION = "trust-2026-05-31-early-leak-rescue";

export function buildPickerConfigHash(parts: {
  addonTransportUrls: string[];
  debridSlugs: string[];
  scraperKeys: string[];
  filterMode: string;
}): string {
  const tokens = [
    TRUST_LOGIC_VERSION,
    `filter:${parts.filterMode}`,
    ...parts.addonTransportUrls.slice().sort(),
    ...parts.debridSlugs.slice().sort(),
    ...parts.scraperKeys.slice().sort(),
  ].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < tokens.length; i++) {
    h ^= tokens.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
