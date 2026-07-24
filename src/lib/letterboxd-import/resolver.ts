/**
 * letterboxd-import/resolver.ts
 *
 * Resolves a list of LbxFilm objects to Harbor-native IMDb IDs using:
 *   1. Cinemeta search (free, always available) → produces tt… IDs
 *   2. TMDB search (optional enhancement, when settings.tmdbKey is set)
 *      → then resolves the TMDB ID to an IMDb ID via external_ids endpoint
 *
 * Films that cannot be resolved are returned with status "unmatched".
 * Unmatched films are NOT written to any store; users can download them as CSV.
 *
 * Existing-library detection:
 *   - If a film's IMDb ID is already in the ratings store → alreadyExists=true, action="Update"
 *   - If a film's IMDb ID is already in the movie-watched store → watchedAlready=true
 *   - If a film's IMDb ID is already in the watchlist → watchlistAlready=true
 *   These flags inform the review table but do not block the import (user decides).
 */

import { safeFetch as fetch } from "@/lib/safe-fetch";
import { tmdbSearchTitle } from "@/lib/providers/tmdb/tmdb-catalogs";
import { tmdbImdbId } from "@/lib/providers/tmdb/tmdb-imdb-resolve";
import { getRating } from "@/lib/ratings/store";
import { isMovieWatchedLocal } from "@/lib/movie-watched";
import { watchlistHas } from "@/lib/watchlist";
import type { LbxFilm } from "./parser";
import type { Meta } from "@/lib/cinemeta";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ResolvedStatus = "matched" | "unmatched";

export type ResolvedItem = {
  film: LbxFilm;
  status: ResolvedStatus;
  /** Resolved Harbor-native Meta object (IMDb id = tt…) */
  meta?: Meta;
  /** True if this item already has a rating in the local store */
  ratingExists: boolean;
  /** True if this item is already locally marked as watched */
  watchedExists: boolean;
  /** True if this item is already in the local watchlist */
  watchlistExists: boolean;
  /** Whether this row is checked (user-controlled, starts true for matched, false for unmatched) */
  checked: boolean;
};

export type ResolveProgress = {
  done: number;
  total: number;
};

// ---------------------------------------------------------------------------
// Cinemeta search
// ---------------------------------------------------------------------------

const CINEMETA = "https://v3-cinemeta.strem.io";

type CinemCatalog = {
  metas?: Array<{
    id: string;
    name: string;
    type: string;
    poster?: string;
    background?: string;
    releaseInfo?: string;
  }>;
};

/**
 * Search Cinemeta for a movie by title + optional year.
 * Returns the best-matching Meta (by year proximity), or null.
 */
async function cinemetaSearch(name: string, year: number): Promise<Meta | null> {
  const encoded = encodeURIComponent(name);
  try {
    const res = await fetch(
      `${CINEMETA}/catalog/movie/top/search=${encoded}.json`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as CinemCatalog;
    const results = json.metas ?? [];
    if (results.length === 0) return null;

    // Pick the best match by title similarity and year proximity (±1)
    const lower = name.toLowerCase();
    const candidates = results.filter((m) => {
      const mName = m.name?.toLowerCase() ?? "";
      const mYear = parseInt(m.releaseInfo ?? "0", 10);
      const nameMatch =
        mName === lower ||
        mName.includes(lower) ||
        lower.includes(mName);
      const yearMatch = year === 0 || Math.abs(mYear - year) <= 1;
      return nameMatch && yearMatch;
    });

    const best = candidates[0] ?? results[0];
    if (!best) return null;

    return {
      id: best.id,
      type: "movie",
      name: best.name,
      poster: best.poster,
      background: best.background,
      releaseInfo: best.releaseInfo,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single-film resolver
// ---------------------------------------------------------------------------

async function resolveFilm(film: LbxFilm, tmdbKey: string): Promise<Meta | null> {
  // --- Primary: Cinemeta ---
  const cinemetaMeta = await cinemetaSearch(film.name, film.year);
  if (cinemetaMeta && cinemetaMeta.id.startsWith("tt")) {
    return cinemetaMeta;
  }

  // --- Secondary: TMDB (only when key present) ---
  if (tmdbKey) {
    const tmdbMeta = await tmdbSearchTitle(tmdbKey, "movie", film.name, film.year || undefined).catch(
      () => null,
    );
    if (tmdbMeta) {
      // Resolve TMDB ID → IMDb ID for a Harbor-native key
      const imdbId = await tmdbImdbId(tmdbKey, tmdbMeta.id).catch(() => null);
      if (imdbId) {
        return { ...tmdbMeta, id: imdbId };
      }
      // If IMDb resolution failed, still return the tmdb: prefixed id as fallback
      return tmdbMeta;
    }
  }

  // --- Tertiary: if Cinemeta returned something non-tt, use it anyway ---
  if (cinemetaMeta) return cinemetaMeta;

  return null;
}

// ---------------------------------------------------------------------------
// Batch resolver — exported entry point
// ---------------------------------------------------------------------------

const CONCURRENCY = 5;

/**
 * Resolve all films in the Letterboxd parse result to Harbor native IDs.
 * Calls `onProgress` after each film is resolved.
 */
export async function resolveItems(
  films: LbxFilm[],
  tmdbKey: string,
  onProgress: (progress: ResolveProgress) => void,
): Promise<ResolvedItem[]> {
  const results: ResolvedItem[] = new Array(films.length);
  let done = 0;

  // Process in batches of CONCURRENCY
  for (let start = 0; start < films.length; start += CONCURRENCY) {
    const batch = films.slice(start, start + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((film) => resolveFilm(film, tmdbKey)),
    );
    for (let j = 0; j < batch.length; j++) {
      const film = batch[j];
      const result = settled[j];
      const meta = result.status === "fulfilled" ? result.value ?? undefined : undefined;
      const metaId = meta?.id;

      const ratingExists = metaId ? getRating(metaId) !== null : false;
      const watchedExists = metaId ? isMovieWatchedLocal(metaId) : false;
      const watchlistExists = metaId ? watchlistHas(metaId) : false;

      const status: ResolvedStatus = meta ? "matched" : "unmatched";

      results[start + j] = {
        film,
        status,
        meta,
        ratingExists,
        watchedExists,
        watchlistExists,
        // Checked by default only for matched items
        checked: status === "matched",
      };
      done++;
      onProgress({ done, total: films.length });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CSV export for unmatched films
// ---------------------------------------------------------------------------

export function unmatchedToCsv(items: ResolvedItem[]): string {
  const unmatched = items.filter((i) => i.status === "unmatched");
  const header = "Name,Year,Letterboxd URI,Letterboxd Rating";
  const rows = unmatched.map((i) => {
    const { name, year, uri, lbxRating } = i.film;
    const escapeCsv = (s: string | number) =>
      `"${String(s).replace(/"/g, '""')}"`;
    return [
      escapeCsv(name),
      year,
      escapeCsv(uri),
      lbxRating ?? "",
    ].join(",");
  });
  return [header, ...rows].join("\r\n");
}
