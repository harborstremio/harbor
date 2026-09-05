import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { loadStoredSettings } from "@/lib/settings/load";
import { get } from "./tmdb-client";
import { tmdbBackdropUrl, tmdbLogoUrl, tmdbPosterUrl } from "./tmdb-image-rungs";
import { imageLangParam, imageLangPriority, imageLangRank } from "./tmdb-image-lang";

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
  const cacheKey = `${metaId}|${originalLang ?? ""}|${imageLangParam(originalLang)}`;
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
  return tmdbLogoUrl(best?.file_path);
};

export async function tmdbLocalizedPoster(
  key: string,
  metaId: string,
  originalLang?: string | null,
): Promise<string | undefined> {
  const st = loadStoredSettings();
  const metaBase = (st.tmdbLanguage ?? "").split("-")[0]?.toLowerCase() ?? "";
  // Artwork language is an independent preference. Use its configured order first,
  // then the metadata language and stable fallbacks when no matching artwork exists.
  const want: string[] = [];
  const add = (c: string | null) => {
    const code = c ?? "";
    if (!want.includes(code)) want.push(code);
  };
  for (const c of imageLangPriority()) {
    if (c === null) {
      add(originalLang ? (originalLang.split("-")[0]?.toLowerCase() ?? null) : null);
      add(null);
    } else add(c);
  }
  if (metaBase) add(metaBase);
  add("en");
  add(originalLang ? (originalLang.split("-")[0]?.toLowerCase() ?? null) : null);
  add(null);
  if (want.length === 0) return undefined;
  const assets = await fetchMovieAssets(key, metaId, originalLang);
  const posters = assets?.posters ?? [];
  if (!posters.length) return undefined;
  const rank = (iso?: string | null) => {
    const i = want.indexOf(iso ?? "");
    return i === -1 ? -1 : want.length - i;
  };
  const best = [...posters].sort(
    (a, b) =>
      rank(b.iso_639_1) - rank(a.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0),
  )[0];
  return tmdbPosterUrl(best?.file_path);
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
    (a, b) =>
      rank(b.iso_639_1) - rank(a.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0),
  )[0];
  const url = tmdbPosterUrl(best?.file_path);
  lruSet(defaultPosterCache, metaId, url ?? null, MOVIE_ASSETS_MAX);
  return url;
}

export async function tmdbMovieImages(key: string, metaId: string): Promise<string[]> {
  const data = await fetchMovieAssets(key, metaId);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of (data?.backdrops ?? []).sort(
    (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
  )) {
    const url = tmdbBackdropUrl(b.file_path);
    if (!url || seen.has(b.file_path)) continue;
    seen.add(b.file_path);
    out.push(url);
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
