import { safeFetch as fetch } from "@/lib/safe-fetch";

const CINEMETA = "https://v3-cinemeta.strem.io";
const META_CACHE_TTL_MS = 20_000;
const META_CACHE_MAX_ENTRIES = 100;
const CINEMETA_META_DEADLINE_MS = 8_000;

type CachedMeta = { value: Meta | null; expiresAt: number };

const metaCache = new Map<string, CachedMeta>();
const metaInFlight = new Map<string, Promise<Meta | null>>();

export function settleWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new DOMException("Cinemeta request exceeded deadline", "TimeoutError")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export type MetaType = "movie" | "series" | "channel" | "tv" | "anime" | "other" | "manga";

export function narrowMediaType(t: MetaType | string | undefined): "movie" | "series" {
  return t === "series" ? "series" : "movie";
}

export type Meta = {
  id: string;
  type: MetaType;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  originalLanguage?: string;
  country?: string;
  malId?: number;
  animeFormat?: string;
  releaseInfo?: string;
  releaseDate?: string;
  inTheaters?: boolean;
  imdbRating?: string;
  adult?: boolean;
  providerBadge?: { name: string; logo: string; tint: string };
  sourceRank?: number;
  tmdbScore?: number;
  runtime?: string;
  genres?: string[];
  trailers?: Array<{ source: string; type?: string }>;
  trailerStreams?: Array<{ ytId?: string; title?: string }>;
  links?: Array<{ name: string; category: string; url: string }>;
  addonOrigin?: { id: string; name: string; logo?: string; base?: string };
  isCollection?: boolean;
  behaviorHints?: { defaultVideoId?: string | null };
  videos?: Array<{
    id?: string;
    season?: number;
    episode?: number;
    number?: number;
    released?: string;
    firstAired?: string;
    name?: string;
    title?: string;
    overview?: string;
    description?: string;
    thumbnail?: string;
    streams?: Array<Record<string, unknown>>;
  }>;
};

export function isAddonNativeMeta(meta: Meta): boolean {
  if (meta.type === "tv" || meta.type === "channel") return true;
  if (!meta.addonOrigin) return false;
  const id = meta.id || "";
  const resolvable =
    /^tt\d/.test(id) || id.startsWith("tmdb:") || id.startsWith("kitsu:") || id.startsWith("mal:");
  return !resolvable;
}

async function catalog(path: string): Promise<Meta[]> {
  const res = await fetch(`${CINEMETA}/catalog/${path}.json`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.metas ?? [];
}

function cinemetaTopPath(type: "movie" | "series", genre?: string, skip = 0): string {
  const parts = [`${type}/top`];
  if (genre) parts.push(`genre=${encodeURIComponent(genre)}`);
  if (skip > 0) parts.push(`skip=${skip}`);
  return parts.join("/");
}

export const topMovies = (genre?: string, skip = 0) =>
  catalog(cinemetaTopPath("movie", genre, skip));

export const topSeries = (genre?: string, skip = 0) =>
  catalog(cinemetaTopPath("series", genre, skip));

export function cinemetaEnabled(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    return raw ? JSON.parse(raw).cinemetaEnabled !== false : true;
  } catch {
    return true;
  }
}

function metaCacheKey(type: "movie" | "series", id: string): string {
  return `${type}:${id}`;
}

function pruneMetaCache(now = Date.now()): void {
  for (const [key, entry] of metaCache) {
    if (entry.expiresAt <= now) metaCache.delete(key);
  }
}

function cachedMeta(key: string): Meta | null | undefined {
  const entry = metaCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    metaCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheMeta(key: string, value: Meta | null): void {
  pruneMetaCache();
  while (metaCache.size >= META_CACHE_MAX_ENTRIES) {
    const oldestKey = metaCache.keys().next().value;
    if (!oldestKey) break;
    metaCache.delete(oldestKey);
  }
  metaCache.set(key, { value, expiresAt: Date.now() + META_CACHE_TTL_MS });
}

async function requestMeta(type: "movie" | "series", id: string): Promise<Meta | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CINEMETA_META_DEADLINE_MS);
  try {
    const res = await fetch(`${CINEMETA}/meta/${type}/${id}.json`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = await res.json();
    return json.meta ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function meta(
  type: "movie" | "series",
  id: string,
  force = false,
): Promise<Meta | null> {
  if (!force && !cinemetaEnabled()) return null;
  const key = metaCacheKey(type, id);
  if (!force) {
    const cached = cachedMeta(key);
    if (cached !== undefined) return cached;
    const inFlight = metaInFlight.get(key);
    if (inFlight) return inFlight;

    const request = requestMeta(type, id).then((result) => {
      cacheMeta(key, result);
      return result;
    });
    metaInFlight.set(key, request);
    try {
      return await request;
    } finally {
      if (metaInFlight.get(key) === request) metaInFlight.delete(key);
    }
  }

  const result = await requestMeta(type, id);
  cacheMeta(key, result);
  return result;
}
