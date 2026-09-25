import { traktRequest, TraktApiError } from "@/lib/trakt/client";
import type { ShowCandidate } from "./resolve";
import type { EpisodeCandidate, ExternalShowIds, SeasonListing } from "./types";

const MAX_SEARCH_RESULTS = 10;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function parseShowIds(value: unknown): ExternalShowIds {
  const raw = asRecord(value);
  if (!raw) return {};
  const ids: ExternalShowIds = {};
  const imdb = str(raw.imdb);
  if (imdb && /^tt\d+$/.test(imdb)) ids.imdb = imdb;
  const tmdb = num(raw.tmdb);
  if (tmdb != null) ids.tmdb = tmdb;
  const tvdb = num(raw.tvdb);
  if (tvdb != null) ids.tvdb = tvdb;
  const trakt = num(raw.trakt);
  if (trakt != null) ids.trakt = trakt;
  const slug = str(raw.slug);
  if (slug) ids.slug = slug;
  return ids;
}

// Trakt resolves a show by trakt, imdb, tmdb or tvdb id in the path. Prefer the
// numeric trakt id so the request never depends on an external id chaining.
export function showIdParam(ids: ExternalShowIds): string | null {
  if (ids.trakt != null) return String(ids.trakt);
  if (ids.imdb) return ids.imdb;
  if (ids.tmdb != null) return String(ids.tmdb);
  if (ids.tvdb != null) return String(ids.tvdb);
  if (ids.slug) return ids.slug;
  return null;
}

// Deliberately unfiltered by year: the entries we need carry a different year than
// Cinemeta reports (reboot 2026 vs 2016, Twin Peaks: The Return under a 1990 show).
export async function searchShows(title: string): Promise<ShowCandidate[]> {
  const params = new URLSearchParams({ query: title, limit: String(MAX_SEARCH_RESULTS) });
  const rows = await traktRequest<unknown>(`/search/show?${params.toString()}`, { authed: false });
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: ShowCandidate[] = [];
  for (const row of rows) {
    const show = asRecord(asRecord(row)?.show);
    if (!show) continue;
    const showIds = parseShowIds(show.ids);
    const key = showIdParam(showIds);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ showIds, title: str(show.title) ?? "", year: num(show.year) });
  }
  return out;
}

const tmdbShowCache = new Map<number, ExternalShowIds>();

// /shows/{id} only accepts a trakt id or slug, so a foreign id has to go through
// /search/{id_type}/{id}. Successes are kept in memory because show ids never move.
export async function showIdsByTmdb(tmdbId: number): Promise<ExternalShowIds | null> {
  if (!Number.isFinite(tmdbId)) return null;
  const cached = tmdbShowCache.get(tmdbId);
  if (cached) return cached;
  try {
    const rows = await traktRequest<unknown>(`/search/tmdb/${tmdbId}?type=show`, {
      authed: false,
    });
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
      const show = asRecord(asRecord(row)?.show);
      if (!show) continue;
      const ids = parseShowIds(show.ids);
      if (ids.imdb || ids.trakt) {
        tmdbShowCache.set(tmdbId, ids);
        return ids;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export type MovieCandidate = {
  ids: ExternalShowIds;
  title: string;
  year: number | null;
};

export async function searchMovies(title: string): Promise<MovieCandidate[]> {
  const params = new URLSearchParams({ query: title, limit: String(MAX_SEARCH_RESULTS) });
  const rows = await traktRequest<unknown>(`/search/movie?${params.toString()}`, { authed: false });
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const out: MovieCandidate[] = [];
  for (const row of rows) {
    const movie = asRecord(asRecord(row)?.movie);
    if (!movie) continue;
    const ids = parseShowIds(movie.ids);
    const key = showIdParam(ids);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ids, title: str(movie.title) ?? "", year: num(movie.year) });
  }
  return out;
}

function parseEpisodes(value: unknown): EpisodeCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: EpisodeCandidate[] = [];
  for (const entry of value) {
    const raw = asRecord(entry);
    if (!raw) continue;
    const number = num(raw.number);
    if (number == null) continue;
    const ids = asRecord(raw.ids) ?? {};
    out.push({
      number,
      title: str(raw.title),
      airDate: str(raw.first_aired) ?? str(raw.released) ?? null,
      tvdbId: num(ids.tvdb),
      imdbId: str(ids.imdb),
    });
  }
  return out;
}

/**
 * One call per candidate show: `extended=episodes` returns every season with its
 * episodes and their external ids, which is what makes exact episode matching
 * affordable inside the resolution budget.
 */
export async function fetchShowSeasons(showIds: ExternalShowIds): Promise<SeasonListing[] | null> {
  const id = showIdParam(showIds);
  if (!id) return null;
  const rows = await traktRequest<unknown>(`/shows/${id}/seasons?extended=episodes`, {
    authed: false,
  });
  if (!Array.isArray(rows)) return null;
  const seasons: SeasonListing[] = [];
  for (const entry of rows) {
    const raw = asRecord(entry);
    if (!raw) continue;
    const number = num(raw.number);
    if (number == null) continue;
    seasons.push({ number, episodes: parseEpisodes(raw.episodes) });
  }
  return seasons;
}

export async function probeEpisode(
  showIds: ExternalShowIds,
  season: number,
  number: number,
): Promise<"found" | "missing" | "error"> {
  const id = showIdParam(showIds);
  if (!id) return "error";
  try {
    await traktRequest(`/shows/${id}/seasons/${season}/episodes/${number}`, { authed: false });
    return "found";
  } catch (error) {
    if (error instanceof TraktApiError && error.status === 404) return "missing";
    return "error";
  }
}
