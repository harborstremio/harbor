import { get, IMG } from "@/lib/providers/tmdb/tmdb-client";
import { matchVodMetadata } from "./vod-match";

export type VodEnrichment = {
  poster: string | null;
  backdrop: string | null;
  overview: string | null;
  year: number | null;
  tmdbId: number | null;
};

type RawHit = {
  id?: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string | null;
  release_date?: string;
  first_air_date?: string;
};
type Page = { results?: RawHit[] };

const cache = new Map<string, Promise<VodEnrichment | null>>();

function cacheKey(kind: "movie" | "series", title: string, year: number | null): string {
  return `${kind}|${title.toLowerCase()}|${year ?? ""}`;
}

export function enrichVod(
  tmdbKey: string,
  kind: "movie" | "series",
  title: string,
  year: number | null,
): Promise<VodEnrichment | null> {
  if (!tmdbKey || !title.trim()) return Promise.resolve(null);
  const key = cacheKey(kind, title, year);
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = run(tmdbKey, kind, title, year);
  cache.set(key, promise);
  return promise;
}

async function run(
  tmdbKey: string,
  kind: "movie" | "series",
  title: string,
  year: number | null,
): Promise<VodEnrichment | null> {
  const path = kind === "series" ? "search/tv" : "search/movie";
  const params: Record<string, string> = { query: title, include_adult: "false" };
  if (year) params[kind === "series" ? "first_air_date_year" : "year"] = String(year);
  const data = await get<Page>(tmdbKey, path, params).catch(() => null);
  const hit = matchVodMetadata(data?.results ?? [], title, year);
  if (!hit) return null;
  const date = hit.release_date || hit.first_air_date || "";
  const hitYear = date ? Number(date.slice(0, 4)) : null;
  return {
    poster: hit.poster_path ? `${IMG}/w342${hit.poster_path}` : null,
    backdrop: hit.backdrop_path ? `${IMG}/w780${hit.backdrop_path}` : null,
    overview: hit.overview?.trim() || null,
    year: Number.isFinite(hitYear) ? hitYear : null,
    tmdbId: hit.id ?? null,
  };
}
