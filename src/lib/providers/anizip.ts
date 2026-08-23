import { safeFetch } from "@/lib/safe-fetch";
import type { AniZipEpisodeTitleFields } from "./anizip-episode-title.ts";
import { aniZipCacheExpiresAt } from "./anizip-cache-policy.ts";

export { pickEpisodeTitle } from "./anizip-episode-title.ts";

const ENDPOINT = "https://api.ani.zip/mappings";
const GAP_MS = 90;
const NEG_TTL_MS = 120000;
type CacheEntry = { mapping: AniZipMapping | null; expiresAt: number | null };
const cache = new Map<string, CacheEntry>();
const negCache = new Map<string, number>();
const inflight = new Map<string, Promise<AniZipMapping | null>>();

let queue: Promise<unknown> = Promise.resolve();
function throttled(url: string, ac: AbortController): Promise<Response> {
  const run = queue.then(async () => {
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      return await safeFetch(url, { signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  });
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  queue = Promise.race([settled, new Promise((r) => setTimeout(r, 5000))]).then(
    () => new Promise((r) => setTimeout(r, GAP_MS)),
  );
  return run;
}

export type AniZipEpisode = AniZipEpisodeTitleFields & {
  seasonNumber?: number;
  episodeNumber: number;
  absoluteEpisodeNumber?: number;
  tvdbShowId?: number;
  tvdbId?: number;
  anidbEid?: number;
  airDate?: string;
  airDateUtc?: string;
  runtime?: number;
  overview?: string;
  image?: string;
  rating?: string;
  finaleType?: string;
  filler?: boolean;
};

export type AniZipMapping = {
  titles?: Record<string, string>;
  episodes?: Record<string, AniZipEpisode>;
  mappings?: {
    anilist_id?: number;
    kitsu_id?: number;
    mal_id?: number;
    anidb_id?: number;
    thetvdb_id?: number;
    themoviedb_id?: number | string;
    imdb_id?: string;
  };
};

export async function aniZipByKitsu(kitsuId: number): Promise<AniZipMapping | null> {
  return get(`kitsu_id=${kitsuId}`);
}

export async function aniZipByAnilist(anilistId: number): Promise<AniZipMapping | null> {
  return get(`anilist_id=${anilistId}`);
}

export async function aniZipByMal(malId: number): Promise<AniZipMapping | null> {
  return get(`mal_id=${malId}`);
}

export async function aniZipByAnidb(anidbId: number): Promise<AniZipMapping | null> {
  return get(`anidb_id=${anidbId}`);
}

export async function aniZipByImdb(imdbId: string): Promise<AniZipMapping | null> {
  return get(`imdb_id=${imdbId}`);
}

export async function aniZipByTmdbTv(tmdbId: number): Promise<AniZipMapping | null> {
  return get(`themoviedb_id=${tmdbId}`);
}

const TIMEOUT_MS = 4000;

async function get(query: string): Promise<AniZipMapping | null> {
  const cached = cache.get(query);
  if (cached) {
    if (cached.expiresAt == null || Date.now() < cached.expiresAt) return cached.mapping;
    cache.delete(query);
  }
  const negAt = negCache.get(query);
  if (negAt != null && Date.now() - negAt < NEG_TTL_MS) return null;
  const existing = inflight.get(query);
  if (existing) return existing;
  const p = (async () => {
    const ac = new AbortController();
    try {
      const res = await throttled(`${ENDPOINT}?${query}`, ac);
      if (!res.ok) {
        if (res.status === 404) {
          cache.set(query, { mapping: null, expiresAt: aniZipCacheExpiresAt(null, Date.now()) });
        }
        else negCache.set(query, Date.now());
        return null;
      }
      const json = (await res.json()) as AniZipMapping;
      cache.set(query, { mapping: json, expiresAt: aniZipCacheExpiresAt(json, Date.now()) });
      negCache.delete(query);
      return json;
    } catch {
      negCache.set(query, Date.now());
      return null;
    } finally {
      inflight.delete(query);
    }
  })();
  inflight.set(query, p);
  return p;
}

export function pickLocalizedTitle(
  ep: AniZipEpisode | undefined,
  lang: string | null | undefined,
): string | null {
  if (!ep?.titles) return null;
  if (lang) {
    const exact = lang.trim();
    if (ep.titles[exact]) return ep.titles[exact];
    const base = exact.split("-")[0]?.toLowerCase() ?? "";
    if (base && ep.titles[base]) return ep.titles[base];
  }
  return ep.titles.en ?? ep.titles["x-jat"] ?? ep.titles.ja ?? null;
}
