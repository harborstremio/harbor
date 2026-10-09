import type { Meta } from "../../cinemeta";
import { get } from "./tmdb-client";
import {
  movieMeta,
  seriesMeta,
  type Page,
  type RawMovie,
  type RawSeries,
} from "./tmdb-meta-mappers";
import { loadStoredSettings } from "../../settings/load";

// When "Translate titles" is off, request TMDB in English so row titles are
// the untranslated English names instead of the original language.
function titleRequestLanguage(): string | undefined {
  return loadStoredSettings().translateTitles ? undefined : "en-US";
}

export async function tmdbMovieRow(
  key: string,
  endpoint: "popular" | "top_rated" | "now_playing" | "upcoming",
  region = "US",
  page = 1,
): Promise<Meta[]> {
  if (endpoint === "now_playing") return tmdbInCinema(key, region, page);
  const lang = titleRequestLanguage();
  const data = await get<Page<RawMovie>>(key, `movie/${endpoint}`, {
    region,
    page: String(page),
    ...(lang ? { language: lang } : {}),
  });
  return (data?.results ?? []).map((m) => movieMeta(m));
}

async function tmdbInCinema(key: string, region: string, page = 1): Promise<Meta[]> {
  const day = 24 * 60 * 60 * 1000;
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  const lang = titleRequestLanguage();
  const data = await get<Page<RawMovie>>(key, "discover/movie", {
    region,
    with_release_type: "3",
    "release_date.gte": fmt(Date.now() - 75 * day),
    "release_date.lte": fmt(Date.now() + 7 * day),
    "with_runtime.gte": "60",
    sort_by: "popularity.desc",
    page: String(page),
    ...(lang ? { language: lang } : {}),
  });
  return (data?.results ?? []).map((m) => ({ ...movieMeta(m), inTheaters: true }));
}

export async function tmdbSeriesRow(
  key: string,
  endpoint: "popular" | "top_rated" | "airing_today" | "on_the_air",
  page = 1,
): Promise<Meta[]> {
  const lang = titleRequestLanguage();
  const data = await get<Page<RawSeries>>(key, `tv/${endpoint}`, {
    page: String(page),
    ...(lang ? { language: lang } : {}),
  });
  return (data?.results ?? []).map((s) => seriesMeta(s));
}

export async function tmdbTrending(
  key: string,
  type: "movie" | "tv",
  window: "day" | "week" = "week",
  page = 1,
): Promise<Meta[]> {
  const lang = titleRequestLanguage();
  const data = await get<Page<RawMovie | RawSeries>>(key, `trending/${type}/${window}`, {
    page: String(page),
    ...(lang ? { language: lang } : {}),
  });
  const results = data?.results ?? [];
  return type === "movie"
    ? (results as RawMovie[]).map((m) => movieMeta(m))
    : (results as RawSeries[]).map((s) => seriesMeta(s));
}

export async function tmdbDiscover(
  key: string,
  type: "movie" | "tv",
  params: Record<string, string>,
): Promise<Meta[]> {
  if (!key) return [];
  const lang = titleRequestLanguage();
  const data = await get<Page<RawMovie | RawSeries>>(key, `discover/${type}`, {
    ...params,
    ...(lang ? { language: lang } : {}),
  });
  const results = data?.results ?? [];
  return type === "movie"
    ? (results as RawMovie[]).map((m) => movieMeta(m))
    : (results as RawSeries[]).map((s) => seriesMeta(s));
}

export async function tmdbSearchMovie(
  key: string,
  query: string,
  year?: number,
): Promise<Meta | null> {
  if (!key || !query.trim()) return null;
  const lang = titleRequestLanguage();
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.year = String(year);
  if (lang) params.language = lang;
  const data = await get<Page<RawMovie>>(key, "search/movie", params);
  const hit = (data?.results ?? [])[0];
  return hit ? movieMeta(hit) : null;
}

export async function tmdbSearchTitle(
  key: string,
  type: "movie" | "series",
  query: string,
  year?: number,
): Promise<Meta | null> {
  if (!key || !query.trim()) return null;
  const lang = titleRequestLanguage();
  if (type === "movie") {
    const params: Record<string, string> = { query, include_adult: "false" };
    if (year) params.year = String(year);
    if (lang) params.language = lang;
    const data = await get<Page<RawMovie>>(key, "search/movie", params);
    const hit = (data?.results ?? [])[0];
    return hit ? movieMeta(hit) : null;
  }
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.first_air_date_year = String(year);
  if (lang) params.language = lang;
  const data = await get<Page<RawSeries>>(key, "search/tv", params);
  const hit = (data?.results ?? [])[0];
  return hit ? seriesMeta(hit) : null;
}
