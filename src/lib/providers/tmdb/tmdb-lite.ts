import { effectiveTmdbLanguage, get } from "./tmdb-client";
import { tmdbBackdropUrl, tmdbPosterUrl } from "./tmdb-image-rungs";

export type TmdbLiteMeta = {
  name: string | null;
  poster: string | null;
  background: string | null;
};

const cache = new Map<string, TmdbLiteMeta | null>();
const inflight = new Map<string, Promise<TmdbLiteMeta | null>>();

type RawLite = {
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
};

const overviewCache = new Map<string, string>();
export async function tmdbMetadataOverview(key: string, metaId: string): Promise<string | undefined> {
  if (!key) return undefined;
  const m = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!m) return undefined;
  const metaLang = effectiveTmdbLanguage() || "en";
  const cacheKey = `${metaId}|${metaLang}`;
  const hit = overviewCache.get(cacheKey);
  if (hit !== undefined) return hit || undefined;
  try {
    const raw = await get<{ overview?: string }>(key, `${m[1]}/${m[2]}`, { language: metaLang });
    const ov = raw?.overview?.trim() || "";
    overviewCache.set(cacheKey, ov);
    return ov || undefined;
  } catch {
    return undefined;
  }
}

export async function tmdbLiteMeta(key: string, metaId: string): Promise<TmdbLiteMeta | null> {
  if (!key) return null;
  const match = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!match) return null;
  const hit = cache.get(metaId);
  if (hit !== undefined) return hit;
  const existing = inflight.get(metaId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const raw = await get<RawLite>(key, `${match[1]}/${match[2]}`);
      const out: TmdbLiteMeta | null = raw
        ? {
            name: (raw.title ?? raw.name ?? "").trim() || null,
            poster: tmdbPosterUrl(raw.poster_path) ?? null,
            background: tmdbBackdropUrl(raw.backdrop_path) ?? null,
          }
        : null;
      cache.set(metaId, out);
      return out;
    } catch {
      return null;
    } finally {
      inflight.delete(metaId);
    }
  })();
  inflight.set(metaId, p);
  return p;
}
