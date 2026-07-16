import type { Meta } from "../../cinemeta";
import { get, IMG } from "./tmdb-client";

export type TmdbCollection = {
  id: number;
  name: string;
  overview: string;
  poster?: string;
  backdrop?: string;
  parts: Meta[];
  genreCounts?: Record<number, number>;
};

const cache = new Map<number, Promise<TmdbCollection | null>>();

export function tmdbCollection(key: string, id: number): Promise<TmdbCollection | null> {
  if (!key || !Number.isFinite(id)) return Promise.resolve(null);
  const existing = cache.get(id);
  if (existing) return existing;
  const promise = run(key, id);
  cache.set(id, promise);
  return promise;
}

async function run(key: string, id: number): Promise<TmdbCollection | null> {
  const raw = await get<any>(key, `collection/${id}`);
  if (!raw) return null;
  const genreCounts: Record<number, number> = {};
  for (const p of raw.parts ?? []) {
    for (const g of p.genre_ids ?? []) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const parts: Meta[] = (raw.parts ?? [])
    .map(
      (p: any): Meta => ({
        id: `tmdb:movie:${p.id}`,
        type: "movie",
        name: p.title ?? p.name ?? "",
        poster: p.poster_path ? `${IMG}/w342${p.poster_path}` : undefined,
        background: p.backdrop_path ? `${IMG}/w780${p.backdrop_path}` : undefined,
        description: p.overview,
        releaseInfo: (p.release_date ?? "").slice(0, 4) || undefined,
        releaseDate: p.release_date || undefined,
        imdbRating: p.vote_average > 0 ? Number(p.vote_average).toFixed(1) : undefined,
        adult: p.adult,
      }),
    )
    .sort((a: Meta, b: Meta) => (a.releaseDate ?? "zzz").localeCompare(b.releaseDate ?? "zzz"));
  return {
    id: raw.id,
    name: raw.name ?? "",
    overview: raw.overview ?? "",
    poster: raw.poster_path ? `${IMG}/w342${raw.poster_path}` : undefined,
    backdrop: raw.backdrop_path ? `${IMG}/original${raw.backdrop_path}` : undefined,
    parts,
    genreCounts,
  };
}

const searchCache = new Map<string, Promise<number | null>>();

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(?:collection|trilogy|saga|series|anthology|the|007)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function collectionNameMatches(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return long.startsWith(`${short} `);
}

export function tmdbSearchCollectionId(key: string, query: string): Promise<number | null> {
  if (!key || !query) return Promise.resolve(null);
  const ck = query.toLowerCase();
  const existing = searchCache.get(ck);
  if (existing) return existing;
  const promise = runSearch(key, query);
  searchCache.set(ck, promise);
  return promise;
}

async function runSearch(key: string, query: string): Promise<number | null> {
  const raw = await get<{ results?: Array<{ id: number; name?: string }> }>(
    key,
    "search/collection",
    { query },
  );
  const results = raw?.results ?? [];
  if (results.length === 0) return null;
  const want = normName(query);
  const exact = results.find((r) => normName(r.name ?? "") === want);
  if (exact) return exact.id;
  const contains = results.find((r) => collectionNameMatches(r.name ?? "", query));
  return (contains ?? results[0])?.id ?? null;
}

export type CollectionHit = { id: number; name: string; backdrop: string | null };

export async function tmdbSearchCollections(
  key: string,
  query: string,
  page = 1,
): Promise<{ hits: CollectionHit[]; totalPages: number }> {
  if (!key || !query.trim()) return { hits: [], totalPages: 0 };
  const raw = await get<{
    results?: Array<{ id: number; name?: string; backdrop_path?: string | null }>;
    total_pages?: number;
  }>(key, "search/collection", { query, page: String(page) });
  const hits = (raw?.results ?? [])
    .filter((r) => Number.isFinite(r.id) && r.name)
    .map((r) => ({
      id: r.id,
      name: r.name ?? "",
      backdrop: r.backdrop_path ? `${IMG}/w780${r.backdrop_path}` : null,
    }));
  return { hits, totalPages: Math.min(raw?.total_pages ?? 0, 500) };
}

export function tmdbCollectionsFeed(
  key: string,
  page: number,
): Promise<{ hits: CollectionHit[]; totalPages: number }> {
  return tmdbSearchCollections(key, "collection", page);
}
