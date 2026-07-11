import { get } from "./tmdb-client";
import { imageLangParam } from "./tmdb-image-lang";
import { pickLogo } from "./tmdb-images";

type SearchTvHit = {
  id: number;
  name: string;
  original_name?: string;
  first_air_date?: string;
  origin_country?: string[];
  original_language?: string;
  popularity?: number;
  genre_ids?: number[];
};

type SearchMovieHit = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string;
  original_language?: string;
  popularity?: number;
  genre_ids?: number[];
};

const ANIMATION_GENRE = 16;

function scoreHit(
  name: string,
  hit: { name: string; year?: string; origin?: string; isAnim?: boolean; popularity?: number },
  targetYear?: string,
): number {
  let s = 0;
  const a = name.toLowerCase().trim();
  const b = hit.name.toLowerCase().trim();
  if (a === b) s += 60;
  else if (b.startsWith(a) || a.startsWith(b)) s += 30;
  else if (b.includes(a)) s += 18;
  if (hit.origin === "JP") s += 25;
  if (hit.isAnim) s += 15;
  if (targetYear && hit.year === targetYear) s += 20;
  else if (targetYear && hit.year && Math.abs(Number(hit.year) - Number(targetYear)) <= 1) s += 8;
  s += Math.min(10, Math.log1p(hit.popularity ?? 0));
  return s;
}

export async function tmdbAnimeMatch(
  key: string,
  name: string,
  year: string | undefined,
  kind: "movie" | "tv",
): Promise<{ id: number; originalLang?: string } | null> {
  if (!key || !name) return null;
  const params: Record<string, string> = { query: name, include_adult: "false" };
  if (year) params[kind === "tv" ? "first_air_date_year" : "year"] = year;
  if (kind === "tv") {
    const data = await get<{ results?: SearchTvHit[] }>(key, "search/tv", params);
    const hits = data?.results ?? [];
    if (hits.length === 0) return null;
    const ranked = hits
      .map((h) => ({
        id: h.id,
        originalLang: h.original_language,
        score: scoreHit(
          name,
          {
            name: h.name || h.original_name || "",
            year: h.first_air_date?.slice(0, 4),
            origin: (h.origin_country ?? [])[0] ?? (h.original_language === "ja" ? "JP" : undefined),
            isAnim: (h.genre_ids ?? []).includes(ANIMATION_GENRE),
            popularity: h.popularity,
          },
          year,
        ),
      }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] ? { id: ranked[0].id, originalLang: ranked[0].originalLang } : null;
  }
  const data = await get<{ results?: SearchMovieHit[] }>(key, "search/movie", params);
  const hits = data?.results ?? [];
  if (hits.length === 0) return null;
  const ranked = hits
    .map((h) => ({
      id: h.id,
      originalLang: h.original_language,
      score: scoreHit(
        name,
        {
          name: h.title || h.original_title || "",
          year: h.release_date?.slice(0, 4),
          origin: h.original_language === "ja" ? "JP" : undefined,
          isAnim: (h.genre_ids ?? []).includes(ANIMATION_GENRE),
          popularity: h.popularity,
        },
        year,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0] ? { id: ranked[0].id, originalLang: ranked[0].originalLang } : null;
}

export async function tmdbAnimeLogo(
  key: string,
  name: string,
  year: string | undefined,
  kind: "movie" | "tv",
): Promise<{ logo?: string; backdrop?: string; tmdbId?: number } | null> {
  const match = await tmdbAnimeMatch(key, name, year, kind);
  if (!match) return null;
  const { id, originalLang } = match;
  const imgs = await get<{ logos?: any[]; backdrops?: any[] }>(key, `${kind}/${id}/images`, {
    include_image_language: imageLangParam(originalLang),
  });
  const logo = pickLogo(imgs?.logos ?? [], originalLang);
  const backdropPath = (imgs?.backdrops ?? [])[0]?.file_path;
  return {
    logo,
    backdrop: backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined,
    tmdbId: id,
  };
}
