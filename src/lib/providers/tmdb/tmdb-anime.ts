import { get } from "./tmdb-client";
import { pickLogo } from "./tmdb-images";
import { imageLangParam } from "./tmdb-image-lang";

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

type NormHit = {
  id: number;
  name: string;
  year?: string;
  origin?: string;
  isAnim?: boolean;
  popularity?: number;
  originalLang?: string;
};

const ANIMATION_GENRE = 16;
const STOPWORDS = new Set(["the", "a", "an", "of", "to", "and", "no", "wa", "ga", "wo", "season", "part"]);

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sigTokens(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
    ),
  ];
}

function scoreHit(name: string, hit: NormHit, targetYear?: string): number {
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

function acceptHit(query: string, hit: NormHit, year: string | undefined, exact: boolean): boolean {
  const qn = normTitle(query);
  const hn = normTitle(hit.name);
  if (!qn || !hn) return false;
  const exactTitle = qn === hn;
  const yearMatch = !!(year && hit.year && Math.abs(Number(hit.year) - Number(year)) <= 1);
  if (exact) return exactTitle && (!year || !hit.year || yearMatch);
  const qTokens = sigTokens(query);
  const hTokens = new Set(sigTokens(hit.name));
  const missing = qTokens.filter((t) => !hTokens.has(t)).length;
  if (missing >= 1 && !yearMatch && !exactTitle) return false;
  const overlap = exactTitle || hn.includes(qn) || qn.includes(hn) || qTokens.some((t) => hTokens.has(t));
  return overlap;
}

async function searchNorm(
  key: string,
  name: string,
  year: string | undefined,
  kind: "movie" | "tv",
): Promise<NormHit[]> {
  const params: Record<string, string> = { query: name, include_adult: "false" };
  if (year) params[kind === "tv" ? "first_air_date_year" : "year"] = year;
  if (kind === "tv") {
    const data = await get<{ results?: SearchTvHit[] }>(key, "search/tv", params);
    return (data?.results ?? []).map((h) => ({
      id: h.id,
      name: h.name || h.original_name || "",
      year: h.first_air_date?.slice(0, 4),
      origin: (h.origin_country ?? [])[0] ?? (h.original_language === "ja" ? "JP" : undefined),
      isAnim: (h.genre_ids ?? []).includes(ANIMATION_GENRE),
      popularity: h.popularity,
      originalLang: h.original_language,
    }));
  }
  const data = await get<{ results?: SearchMovieHit[] }>(key, "search/movie", params);
  return (data?.results ?? []).map((h) => ({
    id: h.id,
    name: h.title || h.original_title || "",
    year: h.release_date?.slice(0, 4),
    origin: h.original_language === "ja" ? "JP" : undefined,
    isAnim: (h.genre_ids ?? []).includes(ANIMATION_GENRE),
    popularity: h.popularity,
    originalLang: h.original_language,
  }));
}

export async function tmdbAnimeMatch(
  key: string,
  name: string,
  year: string | undefined,
  kind: "movie" | "tv",
  opts?: { exact?: boolean },
): Promise<{ id: number; originalLang?: string } | null> {
  if (!key || !name) return null;
  let hits = await searchNorm(key, name, year, kind);
  if (hits.length === 0 && year) hits = await searchNorm(key, name, undefined, kind);
  const exact = opts?.exact === true;
  const ranked = hits
    .filter((h) => acceptHit(name, h, year, exact))
    .map((h) => ({ hit: h, score: scoreHit(name, h, year) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.hit;
  return best ? { id: best.id, originalLang: best.originalLang } : null;
}

export async function tmdbAnimeLogo(
  key: string,
  name: string,
  year: string | undefined,
  kind: "movie" | "tv",
  opts?: { exact?: boolean },
): Promise<{ logo?: string; backdrop?: string; tmdbId?: number } | null> {
  const match = await tmdbAnimeMatch(key, name, year, kind, opts);
  if (!match) return null;
  const { id, originalLang } = match;
  const imgs = await get<{ logos?: any[]; backdrops?: any[] }>(
    key,
    `${kind}/${id}/images`,
    { include_image_language: imageLangParam(originalLang) },
  );
  const logo = pickLogo(imgs?.logos ?? [], originalLang);
  const backdropPath = (imgs?.backdrops ?? [])[0]?.file_path;
  return {
    logo,
    backdrop: backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : undefined,
    tmdbId: id,
  };
}
