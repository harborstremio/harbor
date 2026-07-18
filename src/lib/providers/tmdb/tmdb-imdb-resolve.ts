import { useEffect, useState } from "react";
import { lruSet } from "../../cache";
import { get } from "./tmdb-client";

const IMDB_CACHE_MAX = 3000;
const IMDB_CACHE_KEY = "harbor.tmdb.imdb.v1";
const imdbCache = new Map<string, string | null>();
const inflightImdb = new Map<string, Promise<string | null>>();
const imdbSubs = new Map<string, Set<() => void>>();
let imdbLoaded = false;
let imdbSaveTimer: number | null = null;

function loadImdbCache() {
  if (imdbLoaded) return;
  imdbLoaded = true;
  try {
    const raw = localStorage.getItem(IMDB_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string | null>;
      for (const [k, v] of Object.entries(obj)) imdbCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function persistImdbSoon() {
  if (imdbSaveTimer) clearTimeout(imdbSaveTimer);
  imdbSaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(IMDB_CACHE_KEY, JSON.stringify(Object.fromEntries(imdbCache)));
    } catch {
      /* ignore */
    }
  }, 5000);
}

function notifyImdb(metaId: string) {
  imdbSubs.get(metaId)?.forEach((fn) => fn());
}

export function tmdbImdbCached(metaId?: string): string | null | undefined {
  if (!metaId) return undefined;
  if (metaId.startsWith("tt")) return metaId;
  if (!metaId.startsWith("tmdb:")) return undefined;
  loadImdbCache();
  return imdbCache.has(metaId) ? (imdbCache.get(metaId) ?? null) : undefined;
}

export function subscribeTmdbImdb(metaId: string, fn: () => void): () => void {
  let set = imdbSubs.get(metaId);
  if (!set) {
    set = new Set();
    imdbSubs.set(metaId, set);
  }
  set.add(fn);
  return () => {
    const s = imdbSubs.get(metaId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) imdbSubs.delete(metaId);
  };
}

export function useTmdbImdbId(metaId?: string): string | null | undefined {
  const [v, setV] = useState<string | null | undefined>(() => tmdbImdbCached(metaId));
  useEffect(() => {
    setV(tmdbImdbCached(metaId));
    if (!metaId || metaId.startsWith("tt")) return;
    return subscribeTmdbImdb(metaId, () => setV(tmdbImdbCached(metaId)));
  }, [metaId]);
  return v;
}

export async function tmdbImdbId(key: string, metaId: string): Promise<string | null> {
  if (metaId.startsWith("tt")) return metaId;
  if (!key) return null;
  const match = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!match) return null;
  const [, kind, id] = match;
  loadImdbCache();
  if (imdbCache.has(metaId)) return imdbCache.get(metaId) ?? null;
  if (inflightImdb.has(metaId)) return inflightImdb.get(metaId)!;
  const p = (async () => {
    const data = await get<{ imdb_id?: string | null }>(key, `${kind}/${id}/external_ids`);
    const imdb = data?.imdb_id && data.imdb_id.startsWith("tt") ? data.imdb_id : null;
    lruSet(imdbCache, metaId, imdb, IMDB_CACHE_MAX);
    persistImdbSoon();
    notifyImdb(metaId);
    return imdb;
  })().finally(() => inflightImdb.delete(metaId));
  inflightImdb.set(metaId, p);
  return p;
}

const TMDB_CACHE_MAX = 3000;
const TMDB_CACHE_KEY = "harbor.imdb.tmdb.v1";
const tmdbCache = new Map<string, string | null>();
const inflightTmdb = new Map<string, Promise<string | null>>();
const tmdbSubs = new Map<string, Set<() => void>>();
let tmdbLoaded = false;
let tmdbSaveTimer: number | null = null;

function loadTmdbCache() {
  if (tmdbLoaded) return;
  tmdbLoaded = true;
  try {
    const raw = localStorage.getItem(TMDB_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, string | null>;
      for (const [k, v] of Object.entries(obj)) tmdbCache.set(k, v);
    }
  } catch {
    /* ignore */
  }
}

function persistTmdbSoon() {
  if (tmdbSaveTimer) clearTimeout(tmdbSaveTimer);
  tmdbSaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(Object.fromEntries(tmdbCache)));
    } catch {
      /* ignore */
    }
  }, 5000);
}

function notifyTmdb(imdbId: string) {
  tmdbSubs.get(imdbId)?.forEach((fn) => fn());
}

export function tmdbFromImdbCached(imdbId?: string): string | null | undefined {
  if (!imdbId || !imdbId.startsWith("tt")) return undefined;
  loadTmdbCache();
  return tmdbCache.has(imdbId) ? (tmdbCache.get(imdbId) ?? null) : undefined;
}

export function subscribeImdbTmdb(imdbId: string, fn: () => void): () => void {
  let set = tmdbSubs.get(imdbId);
  if (!set) {
    set = new Set();
    tmdbSubs.set(imdbId, set);
  }
  set.add(fn);
  return () => {
    const s = tmdbSubs.get(imdbId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) tmdbSubs.delete(imdbId);
  };
}

export function useTmdbIdFromImdb(imdbId?: string): string | null | undefined {
  const [v, setV] = useState<string | null | undefined>(() => tmdbFromImdbCached(imdbId));
  useEffect(() => {
    setV(tmdbFromImdbCached(imdbId));
    if (!imdbId || !imdbId.startsWith("tt")) return;
    return subscribeImdbTmdb(imdbId, () => setV(tmdbFromImdbCached(imdbId)));
  }, [imdbId]);
  return v;
}

export async function tmdbIdFromImdb(
  key: string,
  imdbId: string,
  type?: "movie" | "series",
): Promise<string | null> {
  if (!imdbId.startsWith("tt") || !key) return null;
  loadTmdbCache();
  if (tmdbCache.has(imdbId)) return tmdbCache.get(imdbId) ?? null;
  if (inflightTmdb.has(imdbId)) return inflightTmdb.get(imdbId)!;
  const p = (async () => {
    const data = await get<{
      movie_results?: { id: number }[];
      tv_results?: { id: number }[];
    }>(key, `find/${imdbId}`, { external_source: "imdb_id" });
    const movie = data?.movie_results?.[0]?.id;
    const tv = data?.tv_results?.[0]?.id;
    let resolved: string | null = null;
    if (type === "series" && tv) resolved = `tmdb:tv:${tv}`;
    else if (type === "movie" && movie) resolved = `tmdb:movie:${movie}`;
    else if (tv && !movie) resolved = `tmdb:tv:${tv}`;
    else if (movie) resolved = `tmdb:movie:${movie}`;
    else if (tv) resolved = `tmdb:tv:${tv}`;
    lruSet(tmdbCache, imdbId, resolved, TMDB_CACHE_MAX);
    persistTmdbSoon();
    notifyTmdb(imdbId);
    return resolved;
  })().finally(() => inflightTmdb.delete(imdbId));
  inflightTmdb.set(imdbId, p);
  return p;
}
