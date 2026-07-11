import type { Meta } from "@/lib/cinemeta";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { tmdbDiscover } from "@/lib/providers/tmdb";

export type ArabicRowDef = {
  id: string;
  titleKey: string;
  english: string;
  type: "movie" | "series";
  fetch: (key: string, page: number) => Promise<Meta[]>;
};

const ARABIC = "ar-SA";
const RAMADAN_YEARS = [2026, 2025];
const GULF_COUNTRIES = "SA|AE|KW|QA|BH|OM";

function arParams(extra: Record<string, string>): Record<string, string> {
  return {
    language: ARABIC,
    with_original_language: "ar",
    sort_by: "popularity.desc",
    ...extra,
  };
}

function trendingSince(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 18);
  return d.toISOString().slice(0, 10);
}

async function fetchRamadan(key: string, page: number): Promise<Meta[]> {
  const year = RAMADAN_YEARS[(page - 1) % RAMADAN_YEARS.length];
  const cycle = Math.floor((page - 1) / RAMADAN_YEARS.length) + 1;
  return tmdbDiscover(key, "tv", arParams({ first_air_date_year: String(year), page: String(cycle) }));
}

async function fetchDrama(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(key, "tv", arParams({ with_genres: String(TV_GENRES.Drama), page: String(page) }));
}

async function fetchMovies(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(key, "movie", arParams({ page: String(page) }));
}

async function fetchKhaleeji(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(key, "tv", arParams({ with_origin_country: GULF_COUNTRIES, page: String(page) }));
}

async function fetchComedy(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(key, "movie", arParams({ with_genres: String(MOVIE_GENRES.Comedy), page: String(page) }));
}

async function fetchTrending(key: string, page: number): Promise<Meta[]> {
  return tmdbDiscover(
    key,
    "movie",
    arParams({
      "vote_count.gte": "50",
      "primary_release_date.gte": trendingSince(),
      page: String(page),
    }),
  );
}

export const ARABIC_RAMADAN: ArabicRowDef = {
  id: "ramadan",
  titleKey: "arabic.row.ramadan",
  english: "Ramadan 2026 Series",
  type: "series",
  fetch: fetchRamadan,
};

export const ARABIC_DRAMA: ArabicRowDef = {
  id: "drama",
  titleKey: "arabic.row.drama",
  english: "Arabic Drama",
  type: "series",
  fetch: fetchDrama,
};

export const ARABIC_MOVIES: ArabicRowDef = {
  id: "movies",
  titleKey: "arabic.row.movies",
  english: "Arabic Movies",
  type: "movie",
  fetch: fetchMovies,
};

export const ARABIC_KHALEEJI: ArabicRowDef = {
  id: "khaleeji",
  titleKey: "arabic.row.khaleeji",
  english: "Gulf / Khaleeji",
  type: "series",
  fetch: fetchKhaleeji,
};

export const ARABIC_COMEDY: ArabicRowDef = {
  id: "comedy",
  titleKey: "arabic.row.comedy",
  english: "Arabic Comedy",
  type: "movie",
  fetch: fetchComedy,
};

export const ARABIC_TRENDING: ArabicRowDef = {
  id: "trending",
  titleKey: "arabic.row.trending",
  english: "Trending in Arabic",
  type: "movie",
  fetch: fetchTrending,
};
