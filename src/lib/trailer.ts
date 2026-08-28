import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { lruSet } from "@/lib/cache";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { tmdbTrailerList } from "@/lib/providers/tmdb";

export type TrailerInfo = {
  file_path: string;
  stream_url?: string | null;
  quality: string;
  duration_seconds: number;
  title: string;
  size_bytes: number;
};

export type Quality = "360p" | "720p" | "1080p" | "best";
export type TrailerQualityPref = "auto" | Quality;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const TIMEOUT_MS = 270000;
const CACHE_MAX = 64;

const cache = new Map<string, Promise<TrailerInfo | null>>();
const prefetchQueue: Array<() => Promise<unknown>> = [];
let prefetchActive = false;

function cacheKey(videoId: string, quality: Quality): string {
  return `${videoId}:${quality}`;
}

type Conn = { saveData?: boolean; effectiveType?: string; downlink?: number };

function connection(): Conn | undefined {
  return (navigator as Navigator & { connection?: Conn }).connection;
}

export function getQualityHint(): Quality {
  const conn = connection();
  if (!conn) return "720p";
  if (conn.saveData) return "360p";
  if (conn.effectiveType && /^(slow-2g|2g|3g)$/i.test(conn.effectiveType)) return "360p";
  if (typeof conn.downlink === "number" && conn.downlink < 5) return "360p";
  return "720p";
}

export function resolveTrailerQuality(pref: TrailerQualityPref): Quality {
  return pref === "auto" ? getQualityHint() : pref;
}

export function shouldPrefetch(): boolean {
  const conn = connection();
  if (!conn) return true;
  if (conn.saveData) return false;
  if (conn.effectiveType && /^(slow-2g|2g)$/i.test(conn.effectiveType)) return false;
  if (typeof conn.downlink === "number" && conn.downlink < 2) return false;
  return true;
}

export function fetchTrailer(
  videoId: string,
  quality: Quality = getQualityHint(),
): Promise<TrailerInfo | null> {
  if (!isTauri || !videoId) return Promise.resolve(null);
  const key = cacheKey(videoId, quality);
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const extract = invoke<TrailerInfo>("fetch_trailer", { videoId, quality }).catch(
    (error: unknown) => {
      console.error("[harbor::trailer] fetch failed", { videoId, quality, error });
      return null;
    },
  );
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.error("[harbor::trailer] fetch timed out", {
        videoId,
        quality,
        timeoutMs: TIMEOUT_MS,
      });
      resolve(null);
    }, TIMEOUT_MS);
  });
  const p = Promise.race([extract, timeout]).then((result) => {
    if (result === null) cache.delete(key);
    return result;
  });
  cache.set(key, p);
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
  return p;
}

function drainPrefetch() {
  if (prefetchActive) return;
  const next = prefetchQueue.shift();
  if (!next) return;
  prefetchActive = true;
  next().finally(() => {
    prefetchActive = false;
    drainPrefetch();
  });
}

export function prefetchTrailer(videoId: string, quality: Quality = "360p"): void {
  if (!isTauri || !videoId) return;
  if (!shouldPrefetch()) return;
  const key = cacheKey(videoId, quality);
  if (cache.has(key)) return;
  prefetchQueue.push(() => fetchTrailer(videoId, quality));
  drainPrefetch();
}

export function trailerSrc(info: TrailerInfo): string {
  return info.stream_url ?? convertFileSrc(info.file_path);
}

const TRAILER_CACHE_MAX = 500;
const trailerIdCache = new Map<string, string | null>();
const trailerIdInflight = new Map<string, Promise<string | null>>();

export function resolveTrailerId(meta: Meta, tmdbKey: string): Promise<string | null> {
  const cached = trailerIdCache.get(meta.id);
  if (cached !== undefined) return Promise.resolve(cached);
  const inflight = trailerIdInflight.get(meta.id);
  if (inflight) return inflight;
  const isTmdb = meta.id.startsWith("tmdb:");
  const lookup = isTmdb
    ? tmdbTrailerList(tmdbKey, meta.id).then((ids) => ids[0] ?? null)
    : fetchMeta(narrowMediaType(meta.type), meta.id).then((full) => {
        return full?.trailers?.[0]?.source ?? full?.trailerStreams?.[0]?.ytId ?? null;
      });
  const p = lookup
    .catch(() => null)
    .then((id) => {
      lruSet(trailerIdCache, meta.id, id, TRAILER_CACHE_MAX);
      trailerIdInflight.delete(meta.id);
      return id;
    });
  trailerIdInflight.set(meta.id, p);
  return p;
}
