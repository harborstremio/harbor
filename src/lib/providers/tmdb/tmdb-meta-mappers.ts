import type { Meta } from "../../cinemeta";
import { MOVIE_GENRES, TV_GENRES } from "../../feed/tags";
import { loadStoredSettings } from "../../settings/load";
import { IMG } from "./tmdb-client";

export function isAnimeItem(item: {
  genre_ids?: number[];
  genres?: any[];
  original_language?: string;
  origin_country?: string[];
}): boolean {
  const hasAnim =
    (item.genre_ids ?? []).includes(16) ||
    (item.genres ?? []).some((g: any) => g === "Animation" || g?.id === 16);
  const isJp =
    item.original_language === "ja" || (item.origin_country ?? []).includes("JP");
  return hasAnim && isJp;
}

const JAPANESE_SCRIPT = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/;

export type RawMovie = {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  adult?: boolean;
  original_language?: string;
};

export type RawSeries = {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  adult?: boolean;
  original_language?: string;
};

export type Page<T> = { results?: T[] };

export const poster = (p?: string | null) => (p ? `${IMG}/w342${p}` : undefined);
export const back = (p?: string | null) => (p ? `${IMG}/w780${p}` : undefined);
export const year = (s?: string) => (s ? s.slice(0, 4) : undefined);
export const rating = (v?: number) => (v && v > 0 ? v.toFixed(1) : undefined);

const MOVIE_GENRE_NAME = new Map<number, string>(
  Object.entries(MOVIE_GENRES).map(([name, id]) => [id, name]),
);
const TV_GENRE_NAME = new Map<number, string>(
  Object.entries(TV_GENRES).map(([name, id]) => [id, name]),
);

function genresFromIds(ids: number[] | undefined, kind: "movie" | "tv"): string[] | undefined {
  if (!ids || ids.length === 0) return undefined;
  const lookup = kind === "movie" ? MOVIE_GENRE_NAME : TV_GENRE_NAME;
  const names: string[] = [];
  for (const id of ids) {
    const name = lookup.get(id);
    if (name) names.push(name);
  }
  return names.length > 0 ? names : undefined;
}

export const movieMeta = (m: RawMovie, englishName?: string): Meta => {
  const st = loadStoredSettings();
  const translate = st.translateTitles;
  const anime = isAnimeItem(m);
  let name = translate ? m.title : anime ? m.title : m.original_title || m.title;
  if (anime && translate && englishName && JAPANESE_SCRIPT.test(name)) name = englishName;
  return {
    id: `tmdb:movie:${m.id}`,
    type: "movie",
    name,
    poster: poster(m.poster_path),
    background: back(m.backdrop_path),
    description: m.overview,
    originalLanguage: m.original_language,
    releaseInfo: year(m.release_date),
    releaseDate: m.release_date,
    imdbRating: rating(m.vote_average),
    adult: m.adult,
    genres: genresFromIds(m.genre_ids, "movie"),
  };
};

export const seriesMeta = (s: RawSeries, englishName?: string): Meta => {
  const st = loadStoredSettings();
  const translate = st.translateTitles;
  const anime = isAnimeItem(s);
  let name = translate ? s.name : anime ? s.name : s.original_name || s.name;
  if (anime && translate && englishName && JAPANESE_SCRIPT.test(name)) name = englishName;
  return {
    id: `tmdb:tv:${s.id}`,
    type: "series",
    name,
    poster: poster(s.poster_path),
    background: back(s.backdrop_path),
    description: s.overview,
    originalLanguage: s.original_language,
    releaseInfo: year(s.first_air_date),
    releaseDate: s.first_air_date,
    imdbRating: rating(s.vote_average),
    adult: s.adult,
    genres: genresFromIds(s.genre_ids, "tv"),
  };
};
