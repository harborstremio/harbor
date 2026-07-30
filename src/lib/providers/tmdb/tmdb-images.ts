import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { get, IMG } from "./tmdb-client";
import { imageLangParam, imageLangRank, pickedImageLangs } from "./tmdb-image-lang";

export type LogoEntry = { file_path: string; iso_639_1: string | null; vote_average?: number };

export type RawImages = {
  backdrops?: Array<{ file_path: string; vote_average?: number }>;
  logos?: LogoEntry[];
  posters?: Array<{ file_path: string; vote_average?: number; iso_639_1?: string | null }>;
};

const MOVIE_ASSETS_MAX = 400;
const movieAssetsCache = new Map<string, RawImages>();
const movieAssetsInflight = new Map<string, Promise<RawImages | null>>();

registerCache("tmdb:movieAssets", () => movieAssetsCache.size);

export async function fetchMovieAssets(
  key: string,
  metaId: string,
  originalLang?: string | null,
): Promise<RawImages | null> {
  if (!key) return null;
  const match = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!match) return null;
  const cacheKey = originalLang ? `${metaId}|${originalLang}` : metaId;
  const cached = movieAssetsCache.get(cacheKey);
  if (cached) return cached;
  const inflight = movieAssetsInflight.get(cacheKey);
  if (inflight) return inflight;
  const [, kind, id] = match;
  const p = get<RawImages>(key, `${kind}/${id}/images`, {
    include_image_language: imageLangParam(originalLang),
  }).then((data) => {
    movieAssetsInflight.delete(cacheKey);
    if (data) lruSet(movieAssetsCache, cacheKey, data, MOVIE_ASSETS_MAX);
    return data;
  });
  movieAssetsInflight.set(cacheKey, p);
  return p;
}

export const pickLogo = (logos: LogoEntry[], originalLang?: string | null): string | undefined => {
  if (!logos?.length) return undefined;
  const score = (l: LogoEntry) => {
    const r = imageLangRank(l.iso_639_1, originalLang);
    const base = r >= 0 ? r * 100 : 0;
    const isPng = l.file_path?.toLowerCase().endsWith(".png") ? 5 : 0;
    return base + isPng + (l.vote_average ?? 0);
  };
  const best = [...logos].sort((a, b) => score(b) - score(a))[0];
  return best?.file_path ? `${IMG}/w342${best.file_path}` : undefined;
};

export async function tmdbLocalizedPoster(key: string, metaId: string): Promise<string | undefined> {
  const picks = pickedImageLangs();
  if (!picks.length) return undefined;
  const assets = await fetchMovieAssets(key, metaId);
  const posters = (assets?.posters ?? []).filter(
    (p) => typeof p.iso_639_1 === "string" && picks.includes(p.iso_639_1),
  );
  if (!posters.length) return undefined;
  const rank = (iso?: string | null) => {
    const i = picks.indexOf(iso ?? "");
    return i === -1 ? -1 : picks.length - i;
  };
  const best = [...posters].sort(
    (a, b) => rank(b.iso_639_1) - rank(a.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0),
  )[0];
  return best?.file_path ? `${IMG}/w342${best.file_path}` : undefined;
}

const defaultPosterCache = new Map<string, string | null>();
registerCache("tmdb:defaultPoster", () => defaultPosterCache.size);

export async function tmdbDefaultPoster(key: string, metaId: string): Promise<string | undefined> {
  if (!key) return undefined;
  const match = metaId.match(/^tmdb:(movie|tv):(\d+)$/);
  if (!match) return undefined;
  const cached = defaultPosterCache.get(metaId);
  if (cached !== undefined) return cached ?? undefined;
  const [, kind, id] = match;
  const data = await get<RawImages>(key, `${kind}/${id}/images`, {
    include_image_language: "en,null",
  }).catch(() => null);
  const posters = data?.posters ?? [];
  const rank = (iso?: string | null) => (iso === "en" ? 2 : iso == null || iso === "" ? 1 : 0);
  const best = [...posters].sort(
    (a, b) => rank(b.iso_639_1) - rank(a.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0),
  )[0];
  const url = best?.file_path ? `${IMG}/w342${best.file_path}` : undefined;
  lruSet(defaultPosterCache, metaId, url ?? null, MOVIE_ASSETS_MAX);
  return url;
}

export async function tmdbMovieImages(
  key: string,
  metaId: string,
  originalLang?: string | null,
): Promise<string[]> {
  const data = await fetchMovieAssets(key, metaId, originalLang);
  const seen = new Set<string>();
  const out: string[] = [];
  
  const score = (b: { iso_639_1?: string | null; vote_average?: number }) => {
    const r = imageLangRank(b.iso_639_1, originalLang);
    const base = r >= 0 ? r * 100 : 0;
    return base + (b.vote_average ?? 0);
  };
  
  const sorted = [...(data?.backdrops ?? [])].sort((a, b) => score(b) - score(a));
  
  for (const b of sorted) {
    if (!b.file_path || seen.has(b.file_path)) continue;
    seen.add(b.file_path);
    out.push(`${IMG}/w780${b.file_path}`);
    if (out.length >= 12) break;
  }
  return out;
}

export async function tmdbLogo(
  key: string,
  metaId: string,
  originalLang?: string | null,
): Promise<string | undefined> {
  const data = await fetchMovieAssets(key, metaId, originalLang);
  return pickLogo(data?.logos ?? [], originalLang);
}
