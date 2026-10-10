import { COUNTRIES } from "@/views/calendar/config/constants";
import {
  GENRE_MOVIE_TO_TV,
  GENRE_TV_TO_MOVIE,
  LANGUAGES,
  MOVIE_GENRES,
  TV_GENRES,
} from "@/lib/feed/tags";

export type GenreFilters = {
  yearFrom: string;
  yearTo: string;
  minRating: string;
  minVotes: string;
  language: string;
  country: string;
  sort: string;
};

export type Option = { value: string; label: string };

export const EMPTY_FILTERS: GenreFilters = {
  yearFrom: "",
  yearTo: "",
  minRating: "",
  minVotes: "",
  language: "",
  country: "",
  sort: "",
};

const NOW_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS: Option[] = [
  { value: "", label: "Any" },
  ...Array.from({ length: NOW_YEAR - 1949 }, (_, i) => {
    const y = String(NOW_YEAR - i);
    return { value: y, label: y };
  }),
];

export const RATING_OPTIONS: Option[] = [
  { value: "", label: "Any" },
  { value: "6", label: "6+" },
  { value: "7", label: "7+" },
  { value: "7.5", label: "7.5+" },
  { value: "8", label: "8+" },
  { value: "8.5", label: "8.5+" },
];

export const VOTES_OPTIONS: Option[] = [
  { value: "", label: "Any" },
  { value: "100", label: "100+" },
  { value: "500", label: "500+" },
  { value: "1000", label: "1k+" },
  { value: "5000", label: "5k+" },
  { value: "10000", label: "10k+" },
];

export const SORT_OPTIONS: Option[] = [
  { value: "", label: "Recommended" },
  { value: "popularity", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

export const LANGUAGE_OPTIONS: Option[] = [
  { value: "", label: "Any language" },
  ...LANGUAGES.map((l) => ({
    value: l.code,
    label: l.label.replace(/ Cinema$/, "").replace(/-Language$/, ""),
  })),
];

export const COUNTRY_OPTIONS: Option[] = [
  { value: "", label: "Any country" },
  ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
];

export function genreNamesFor(mediaType: "movie" | "tv"): string[] {
  return Object.keys(mediaType === "movie" ? MOVIE_GENRES : TV_GENRES);
}

export function genreIdFor(name: string, mediaType: "movie" | "tv"): number {
  return (mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[name] ?? 0;
}

export function remapGenre(
  name: string,
  id: number,
  toType: "movie" | "tv",
): { name: string; id: number } {
  const set = toType === "movie" ? MOVIE_GENRES : TV_GENRES;
  const direct = set[name];
  if (direct != null) return { name, id: direct };
  const mappedId = toType === "tv" ? GENRE_MOVIE_TO_TV[id] : GENRE_TV_TO_MOVIE[id];
  if (mappedId != null) {
    const hit = Object.entries(set).find(([, v]) => v === mappedId);
    if (hit) return { name: hit[0], id: hit[1] };
  }
  const fallback = set.Drama != null ? "Drama" : Object.keys(set)[0];
  return { name: fallback, id: set[fallback] ?? 18 };
}

export function hasActiveFilters(f: GenreFilters): boolean {
  return Boolean(
    f.yearFrom || f.yearTo || f.minRating || f.minVotes || f.language || f.country || f.sort,
  );
}

export function initialBrowsePage(f: GenreFilters): number {
  return hasActiveFilters(f) ? 1 : 1 + Math.floor(Math.random() * 3);
}

const RATING_CALIBRATION: Record<string, { tmdb: string; votes: number }> = {
  "6": { tmdb: "5.0", votes: 100 },
  "7": { tmdb: "6.0", votes: 200 },
  "7.5": { tmdb: "6.4", votes: 300 },
  "8": { tmdb: "6.8", votes: 400 },
  "8.5": { tmdb: "7.2", votes: 600 },
};

export function buildDiscoverParams(
  genreId: number,
  mediaType: "movie" | "tv",
  f: GenreFilters,
): Record<string, string> {
  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  const sortBy =
    f.sort === "rating"
      ? "vote_average.desc"
      : f.sort === "newest"
        ? `${dateField}.desc`
        : "popularity.desc";
  const cal = f.minRating ? RATING_CALIBRATION[f.minRating] : null;
  const voteFloor = Math.max(Number(f.minVotes || 0), cal?.votes ?? 0, 40);
  const params: Record<string, string> = {
    with_genres: String(genreId),
    include_adult: "false",
    sort_by: sortBy,
    "vote_count.gte": String(voteFloor),
  };
  if (cal) params["vote_average.gte"] = cal.tmdb;
  if (f.yearFrom) params[`${dateField}.gte`] = `${f.yearFrom}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  let lte = f.yearTo ? `${f.yearTo}-12-31` : "";
  if (f.sort === "newest" && (!lte || lte > today)) lte = today;
  if (lte) params[`${dateField}.lte`] = lte;
  if (f.language) params.with_original_language = f.language;
  if (f.country) params.with_origin_country = f.country;
  return params;
}
