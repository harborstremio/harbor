import type { Meta } from "@/lib/cinemeta";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { tmdbDiscover } from "@/lib/providers/tmdb";

export type RussianRowDef = {
  id: string;
  title: string;
  type: "movie" | "series";
  // Rows without a window run all year. Only the New Year canon sets one: those
  // films are a 31 December ritual and read as filler in June.
  window?: (now: Date) => boolean;
  fetch: (key: string, page: number) => Promise<Meta[]>;
};

const RUSSIAN = "ru-RU";
const SOVIET_END = "1991-12-31";
const MODERN_SERIES_YEARS = 8;

function ruParams(extra: Record<string, string>): Record<string, string> {
  return {
    language: RUSSIAN,
    with_original_language: "ru",
    sort_by: "popularity.desc",
    ...extra,
  };
}

function yearsAgo(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchMovies(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(key, "movie", ruParams({ page: String(page) }));
}

async function fetchSovietClassics(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "movie",
    ruParams({
      "primary_release_date.lte": SOVIET_END,
      "vote_count.gte": "40",
      sort_by: "vote_average.desc",
      page: String(page),
    }),
  );
}

async function fetchModernSeries(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "tv",
    ruParams({ "first_air_date.gte": yearsAgo(MODERN_SERIES_YEARS), page: String(page) }),
  );
}

async function fetchDrama(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "tv",
    ruParams({ with_genres: String(TV_GENRES.Drama), page: String(page) }),
  );
}

async function fetchAnimation(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "movie",
    ruParams({ with_genres: String(MOVIE_GENRES.Animation), page: String(page) }),
  );
}

async function fetchTrending(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "movie",
    ruParams({
      "vote_count.gte": "50",
      "primary_release_date.gte": monthsAgo(18),
      page: String(page),
    }),
  );
}

export const RUSSIAN_MOVIES: RussianRowDef = {
  id: "movies",
  title: "Russian Movies",
  type: "movie",
  fetch: fetchMovies,
};

export const RUSSIAN_SOVIET: RussianRowDef = {
  id: "soviet",
  title: "Soviet Classics",
  type: "movie",
  fetch: fetchSovietClassics,
};

export const RUSSIAN_MODERN_SERIES: RussianRowDef = {
  id: "modern-series",
  title: "Modern Russian Series",
  type: "series",
  fetch: fetchModernSeries,
};

export const RUSSIAN_DRAMA: RussianRowDef = {
  id: "drama",
  title: "Russian Drama",
  type: "series",
  fetch: fetchDrama,
};

export const RUSSIAN_ANIMATION: RussianRowDef = {
  id: "animation",
  title: "Russian Animation",
  type: "movie",
  fetch: fetchAnimation,
};

export const RUSSIAN_TRENDING: RussianRowDef = {
  id: "trending",
  title: "Trending in Russian",
  type: "movie",
  fetch: fetchTrending,
};
