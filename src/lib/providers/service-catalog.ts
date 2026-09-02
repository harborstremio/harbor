import type { Meta } from "@/lib/cinemeta";
import { safeFetch } from "@/lib/safe-fetch";

export type Category = {
  id: string;
  label: string;
  fetchMovies: boolean;
  fetchTv: boolean;
  movieGenres: number[];
  tvGenres: number[];
};

export const CATEGORIES: Category[] = [
  { id: "all", label: "All", fetchMovies: true, fetchTv: true, movieGenres: [], tvGenres: [] },
  { id: "movies", label: "Movies", fetchMovies: true, fetchTv: false, movieGenres: [], tvGenres: [] },
  { id: "tv", label: "TV Shows", fetchMovies: false, fetchTv: true, movieGenres: [], tvGenres: [] },
  { id: "docs", label: "Documentaries", fetchMovies: true, fetchTv: true, movieGenres: [99], tvGenres: [99] },
  { id: "anim", label: "Animation", fetchMovies: true, fetchTv: true, movieGenres: [16], tvGenres: [16] },
  { id: "kids", label: "Kids & Family", fetchMovies: true, fetchTv: true, movieGenres: [10751], tvGenres: [10751] },
  { id: "reality", label: "Reality", fetchMovies: false, fetchTv: true, movieGenres: [], tvGenres: [10764] },
  { id: "action", label: "Action", fetchMovies: true, fetchTv: true, movieGenres: [28], tvGenres: [10759] },
  { id: "comedy", label: "Comedy", fetchMovies: true, fetchTv: true, movieGenres: [35], tvGenres: [35] },
  { id: "drama", label: "Drama", fetchMovies: true, fetchTv: true, movieGenres: [18], tvGenres: [18] },
  { id: "horror", label: "Horror", fetchMovies: true, fetchTv: true, movieGenres: [27], tvGenres: [9648] },
  { id: "scifi", label: "Sci-Fi & Fantasy", fetchMovies: true, fetchTv: true, movieGenres: [878], tvGenres: [10765] },
  { id: "thriller", label: "Thriller", fetchMovies: true, fetchTv: false, movieGenres: [53], tvGenres: [] },
  { id: "romance", label: "Romance", fetchMovies: true, fetchTv: false, movieGenres: [10749], tvGenres: [] },
];

export const MAX_PER_BUCKET = 200;

export type Bucket = { movies: Meta[]; series: Meta[] };

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const PAGE_BATCH = 5;

async function fetchPage(
  key: string,
  kind: "movie" | "tv",
  providerIds: string,
  region: string,
  page: number,
  genres: number[],
): Promise<any[]> {
  const params = new URLSearchParams({
    api_key: key,
    with_watch_providers: providerIds,
    watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: "false",
    page: String(page),
  });
  if (genres.length > 0) params.set("with_genres", genres.join(","));
  const url = `${TMDB}/discover/${kind}?${params.toString()}`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch (e) {
    console.warn("[service] fetchPage failed", { kind, providerIds, region, page, error: e });
    return [];
  }
}

export async function fetchCategoryBatch(
  key: string,
  providerIds: string,
  region: string,
  cat: Category,
  batch: number,
  perBatch: number = PAGE_BATCH,
): Promise<Bucket> {
  if (!key) return { movies: [], series: [] };
  const startPage = batch * perBatch + 1;
  const pages = Array.from({ length: perBatch }, (_, i) => startPage + i);
  const moviePromise: Promise<any[][]> = cat.fetchMovies
    ? Promise.all(pages.map((p) => fetchPage(key, "movie", providerIds, region, p, cat.movieGenres)))
    : Promise.resolve([]);
  const tvPromise: Promise<any[][]> = cat.fetchTv
    ? Promise.all(pages.map((p) => fetchPage(key, "tv", providerIds, region, p, cat.tvGenres)))
    : Promise.resolve([]);
  const [movieResults, tvResults] = await Promise.all([moviePromise, tvPromise]);
  const movieRaw = movieResults.flat().filter((m: any) => m.poster_path);
  const tvRaw = tvResults.flat().filter((s: any) => s.poster_path);
  const movies: Meta[] = movieRaw.map((m: any) => ({
    id: `tmdb:movie:${m.id}`,
    type: "movie" as const,
    name: m.title,
    poster: `${IMG}/w342${m.poster_path}`,
    background: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : undefined,
    description: m.overview,
    releaseInfo: m.release_date?.slice(0, 4),
    releaseDate: m.release_date,
    imdbRating: m.vote_average > 0 ? Number(m.vote_average).toFixed(1) : undefined,
  }));
  const series: Meta[] = tvRaw.map((s: any) => ({
    id: `tmdb:tv:${s.id}`,
    type: "series" as const,
    name: s.name,
    poster: `${IMG}/w342${s.poster_path}`,
    background: s.backdrop_path ? `${IMG}/w780${s.backdrop_path}` : undefined,
    description: s.overview,
    releaseInfo: s.first_air_date?.slice(0, 4),
    releaseDate: s.first_air_date,
    imdbRating: s.vote_average > 0 ? Number(s.vote_average).toFixed(1) : undefined,
  }));
  return { movies: dedupe(movies), series: dedupe(series) };
}

export function dedupe(metas: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}
