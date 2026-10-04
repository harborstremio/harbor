import { pmdbRequest, PmdbApiError } from "./client";
import { isAuthenticated } from "./session";
import type { PmdbMediaType } from "./types";

export type { PmdbMediaType };

const LS_KEY = "harbor.pmdb.mappings.v1";
const NEG_TTL_MS = 24 * 60 * 60 * 1000;
const MEM_MAX = 2000;

type ByTmdb = { imdb: string | null; at: number };
type ByExt = { tmdb_id: number | null; media_type?: PmdbMediaType; at: number };

type CacheShape = {
  byTmdb: Record<string, ByTmdb>;
  byExt: Record<string, ByExt>;
};

let cache: CacheShape | null = null;

function loadCache(): CacheShape {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CacheShape>) : null;
    cache = {
      byTmdb: parsed && typeof parsed.byTmdb === "object" && parsed.byTmdb ? parsed.byTmdb : {},
      byExt: parsed && typeof parsed.byExt === "object" && parsed.byExt ? parsed.byExt : {},
    };
  } catch {
    cache = { byTmdb: {}, byExt: {} };
  }
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    const tmdbKeys = Object.keys(cache.byTmdb);
    const extKeys = Object.keys(cache.byExt);
    for (const k of tmdbKeys.slice(0, Math.max(0, tmdbKeys.length - MEM_MAX))) {
      delete cache.byTmdb[k];
    }
    for (const k of extKeys.slice(0, Math.max(0, extKeys.length - MEM_MAX))) {
      delete cache.byExt[k];
    }
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota */
  }
}

export function clearPmdbMappingsCache(): void {
  cache = { byTmdb: {}, byExt: {} };
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

function isFresh(at: number, neg: boolean): boolean {
  // Positive community mappings are stable; negatives can gain votes over time.
  if (!neg) return true;
  return Date.now() - at < NEG_TTL_MS;
}

function asImdbId(value: unknown): string | null {
  return typeof value === "string" && /^tt\d+$/.test(value) ? value : null;
}

function isImdbKey(key: string): boolean {
  return /imdb/i.test(key);
}

/** Extracts an IMDb id from a mapping payload of unknown exact shape. */
export function extractImdbId(data: unknown, depth = 0): string | null {
  if (data == null || depth > 4) return null;
  if (Array.isArray(data)) {
    for (const entry of data) {
      const found = extractImdbId(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.id_type === "string" && isImdbKey(obj.id_type)) {
      const paired = asImdbId(obj.id_value);
      if (paired) return paired;
    }
    for (const [key, value] of Object.entries(obj)) {
      if (isImdbKey(key)) {
        const direct = asImdbId(value);
        if (direct) return direct;
      }
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const nested = extractImdbId(value, depth + 1);
        if (nested) return nested;
      }
    }
    return null;
  }
  return null;
}

function asTmdbId(value: unknown): number | null {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function asMediaType(value: unknown): PmdbMediaType | undefined {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (s === "movie" || s === "tv") return s;
  return undefined;
}

/** Extracts a TMDB id (plus media type when present) from a lookup payload. */
export function extractTmdbId(
  data: unknown,
  depth = 0,
): { tmdb_id: number; media_type?: PmdbMediaType } | null {
  if (data == null || depth > 4) return null;
  if (Array.isArray(data)) {
    for (const entry of data) {
      const found = extractTmdbId(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (lower === "tmdb_id" || lower === "themoviedb_id") {
        const id = asTmdbId(value);
        if (id != null) {
          return {
            tmdb_id: id,
            media_type: asMediaType(obj.media_type ?? obj.mediaType),
          };
        }
      }
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") {
        const nested = extractTmdbId(value, depth + 1);
        if (nested) return nested;
      }
    }
    return null;
  }
  return null;
}

/**
 * Resolves a TMDB id to its IMDb id through PMDB's community mappings.
 * Returns null when unknown; results are cached (negatives for 24h).
 */
export async function getImdbForTmdb(
  tmdbId: number,
  mediaType: PmdbMediaType,
): Promise<string | null> {
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return null;
  if (!isAuthenticated()) return null;
  const key = `tmdb:${mediaType}:${Math.floor(tmdbId)}`;
  const c = loadCache();
  const hit = c.byTmdb[key];
  if (hit && isFresh(hit.at, hit.imdb == null)) return hit.imdb;

  let imdb: string | null = null;
  let ok = false;
  try {
    const data = await pmdbRequest<unknown>(
      `/api/external/mappings?tmdb_id=${Math.floor(tmdbId)}&media_type=${mediaType}`,
      { method: "GET" },
    );
    ok = true;
    imdb = extractImdbId(data);
  } catch (err) {
    if (err instanceof PmdbApiError && err.status === 404) {
      ok = true;
      imdb = null;
    } else {
      return null;
    }
  }
  c.byTmdb[key] = { imdb, at: Date.now() };
  persist();
  void ok;
  return imdb;
}

/**
 * Resolves an external id (imdb, mal, anilist, …) to its TMDB id.
 * Returns null when unknown; results are cached (negatives for 24h).
 */
export async function getTmdbForExternal(
  idType: string,
  idValue: string,
): Promise<{ tmdb_id: number; media_type?: PmdbMediaType } | null> {
  if (!idType || !idValue) return null;
  if (!isAuthenticated()) return null;
  const key = `ext:${idType.toLowerCase()}:${idValue}`;
  const c = loadCache();
  const hit = c.byExt[key];
  if (hit && isFresh(hit.at, hit.tmdb_id == null)) {
    return hit.tmdb_id == null ? null : { tmdb_id: hit.tmdb_id, media_type: hit.media_type };
  }

  let found: { tmdb_id: number; media_type?: PmdbMediaType } | null = null;
  let ok = false;
  try {
    const params = new URLSearchParams({ id_type: idType, id_value: idValue });
    const data = await pmdbRequest<unknown>(`/api/external/mappings/lookup?${params.toString()}`, {
      method: "GET",
    });
    ok = true;
    found = extractTmdbId(data);
  } catch (err) {
    if (err instanceof PmdbApiError && err.status === 404) {
      ok = true;
      found = null;
    } else {
      return null;
    }
  }
  c.byExt[key] = {
    tmdb_id: found?.tmdb_id ?? null,
    media_type: found?.media_type,
    at: Date.now(),
  };
  if (found && idType.toLowerCase() === "imdb" && /^tt\d+$/.test(idValue)) {
    const media = found.media_type ?? "tv";
    c.byTmdb[`tmdb:${media}:${found.tmdb_id}`] = { imdb: idValue, at: Date.now() };
  }
  persist();
  void ok;
  return found;
}
