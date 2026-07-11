import { activeProfileId } from "@/lib/active-profile-id";

import type { WatchlistStatus } from "../list-status";

export type SimklCacheItem = {
  simklId: number;
  type: "movie" | "show" | "anime";
  title: string;
  year: number | null;
  status: WatchlistStatus;
  userRating: number | null;
  watchedAt: string | null;
  watchedEpisodes?: string[];
  poster?: string | null;
};

export type SimklCache = {
  lastSync: string | null;
  activities: {
    movies: string | null;
    shows: string | null;
    anime: string | null;
    ratings: string | null;
  } | null;
  items: Record<string, SimklCacheItem>;
  imdbToSimkl: Record<string, number>;
  tmdbToSimkl: Record<string, number>;
  malToSimkl: Record<string, number>;
  kitsuToSimkl: Record<string, number>;
};

export interface RawIds {
  simkl?: number;
  imdb?: string;
  tmdb?: number | string;
  tvdb?: number;
  mal?: number;
  anidb?: number;
  kitsu?: number | string;
}

const CACHE_KEY_BASE = "harbor.simkl.cache.v2";
function cacheKey(): string {
  return `${CACHE_KEY_BASE}.${activeProfileId()}`;
}
let memoryCache: SimklCache | null = null;
let memoryCacheLoaded = false;
let writeTimeout: number | null = null;

export function getLocalCache(): SimklCache | null {
  if (memoryCacheLoaded) return memoryCache;
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey());
    if (raw) memoryCache = JSON.parse(raw) as SimklCache;
  } catch (e) {
    console.error("Failed to parse SIMKL cache", e);
  }
  memoryCacheLoaded = true;
  return memoryCache;
}

export function saveLocalCache(cache: SimklCache) {
  memoryCache = cache;
  memoryCacheLoaded = true;
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (writeTimeout !== null) return;
  writeTimeout = window.setTimeout(() => {
    writeTimeout = null;
    try {
      if (memoryCache) localStorage.setItem(cacheKey(), JSON.stringify(memoryCache));
    } catch (e) {
      console.error("Failed to save SIMKL cache asynchronously", e);
    }
  }, 1000);
}

export function clearLocalCache() {
  memoryCache = null;
  memoryCacheLoaded = true;
  if (writeTimeout !== null) {
    window.clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(cacheKey());
  } catch (e) {
    console.error("Failed to clear SIMKL cache", e);
  }
}

export function resetForProfile() {
  memoryCache = null;
  memoryCacheLoaded = false;
  if (writeTimeout !== null) {
    window.clearTimeout(writeTimeout);
    writeTimeout = null;
  }
}

export function emptyCache(): SimklCache {
  return {
    lastSync: null,
    activities: null,
    items: {},
    imdbToSimkl: {},
    tmdbToSimkl: {},
    malToSimkl: {},
    kitsuToSimkl: {},
  };
}

export function indexItem(cache: SimklCache, item: SimklCacheItem, ids: RawIds | undefined) {
  if (!ids) return;
  const simklId = item.simklId;
  if (ids.imdb) {
    cache.imdbToSimkl[ids.imdb] = simklId;
  }
  if (ids.tmdb != null) {
    const tmdbKey = item.type === "movie" ? `movie:${ids.tmdb}` : `tv:${ids.tmdb}`;
    cache.tmdbToSimkl[tmdbKey] = simklId;
  }
  if (ids.mal != null) {
    cache.malToSimkl[String(ids.mal)] = simklId;
  }
  if (ids.kitsu != null) {
    cache.kitsuToSimkl[String(ids.kitsu)] = simklId;
  }
}

export function pruneItem(cache: SimklCache, simklId: number) {
  delete cache.items[String(simklId)];
  for (const key of Object.keys(cache.imdbToSimkl)) {
    if (cache.imdbToSimkl[key] === simklId) delete cache.imdbToSimkl[key];
  }
  for (const key of Object.keys(cache.tmdbToSimkl)) {
    if (cache.tmdbToSimkl[key] === simklId) delete cache.tmdbToSimkl[key];
  }
  for (const key of Object.keys(cache.malToSimkl)) {
    if (cache.malToSimkl[key] === simklId) delete cache.malToSimkl[key];
  }
  for (const key of Object.keys(cache.kitsuToSimkl)) {
    if (cache.kitsuToSimkl[key] === simklId) delete cache.kitsuToSimkl[key];
  }
}
