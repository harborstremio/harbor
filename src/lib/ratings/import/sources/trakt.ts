import type { RatingMediaType } from "@/lib/ratings/types";
import { TraktApiError, traktRequest } from "@/lib/trakt/client";
import { getSession } from "@/lib/trakt/session";
import { isRated, normalizeScore, scoreIsValid } from "../types";
import type { ExternalIds, ImportProgress, ImportedRating, RatingsSource } from "../types";

type SyncType = "movies" | "shows";

type RawIds = {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
};

type RawItem = {
  title?: string;
  year?: number | null;
  genres?: string[] | null;
  ids?: RawIds;
};

type RawRow = {
  rated_at?: string;
  rating?: number;
  type?: string;
  movie?: RawItem;
  show?: RawItem;
};

const PAGE_LIMIT = 250;
const MAX_PAGES = 200;
const PAGE_GAP_MS = 250;
const TCONST = /^tt\d+$/;
const ANIME_GENRE = "anime";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function posInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIds(raw: RawIds | undefined): ExternalIds {
  const ids: ExternalIds = {};
  if (!raw) return ids;
  const imdb = text(raw.imdb);
  if (TCONST.test(imdb)) ids.imdb = imdb;
  const tmdb = posInt(raw.tmdb);
  if (tmdb) ids.tmdb = tmdb;
  const tvdb = posInt(raw.tvdb);
  if (tvdb) ids.tvdb = tvdb;
  const trakt = posInt(raw.trakt);
  if (trakt) ids.trakt = trakt;
  const slug = text(raw.slug);
  if (slug) ids.slug = slug;
  return ids;
}

function ratedAtMs(value: unknown): number | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

function itemOf(row: RawRow): RawItem | null {
  if (row.type === "movie") return row.movie ?? null;
  if (row.type === "show") return row.show ?? null;
  return null;
}

function hasAnimeGenre(item: RawItem): boolean {
  const genres = item.genres;
  if (!Array.isArray(genres)) return false;
  return genres.some((g) => typeof g === "string" && g.trim().toLowerCase() === ANIME_GENRE);
}

function mediaTypeOf(row: RawRow, item: RawItem): RatingMediaType {
  if (hasAnimeGenre(item)) return "anime";
  return row.type === "movie" ? "movie" : "series";
}

function toRating(row: RawRow): ImportedRating | null {
  const item = itemOf(row);
  if (!item) return null;
  const raw = row.rating;
  if (typeof raw !== "number" || !isRated(raw)) return null;
  const score = normalizeScore(raw, "point10");
  if (!scoreIsValid(score)) return null;
  const title = text(item.title).slice(0, 300);
  if (!title) return null;
  const rating: ImportedRating = {
    sourceId: "trakt",
    score,
    mediaType: mediaTypeOf(row, item),
    title,
    ids: toIds(item.ids),
  };
  const year = posInt(item.year);
  if (year) rating.year = year;
  const ratedAt = ratedAtMs(row.rated_at);
  if (ratedAt !== undefined) rating.ratedAt = ratedAt;
  return rating;
}

function rowKey(row: RawRow): string | null {
  const item = itemOf(row);
  const id = posInt(item?.ids?.trakt);
  return id ? `${row.type}:${id}` : null;
}

function fail(err: unknown): never {
  if (err instanceof DOMException && err.name === "AbortError") throw err;
  if (err instanceof TraktApiError) {
    if (err.status === 401 || err.status === 403) {
      throw new Error(
        "Trakt sign in expired. Reconnect your Trakt account in Settings, then run the import again.",
      );
    }
    if (err.status === 423) {
      throw new Error(
        "Your Trakt account is locked. Run a history analysis at trakt.tv/settings/data, then run the import again.",
      );
    }
    if (err.status === 410) {
      throw new Error(
        "Your Trakt account is deactivated. Sign in at trakt.tv to reactivate it, then run the import again.",
      );
    }
    if (err.status === 429) {
      throw new Error("Trakt is rate limiting this app. Wait a minute, then run the import again.");
    }
    throw new Error(`Trakt request failed with HTTP ${err.status}. Run the import again in a moment.`);
  }
  throw err instanceof Error ? err : new Error("Trakt request failed.");
}

async function fetchPage(type: SyncType, page: number): Promise<RawRow[]> {
  const rows = await traktRequest<RawRow[]>(
    `/sync/ratings/${type}?extended=full&page=${page}&limit=${PAGE_LIMIT}`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function fetchType(
  type: SyncType,
  label: string,
  offset: number,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  const out: ImportedRating[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    throwIfAborted(signal);
    if (page > 1) {
      await sleep(PAGE_GAP_MS);
      throwIfAborted(signal);
    }
    const rows = await fetchPage(type, page).catch(fail);
    if (rows.length === 0) break;
    let fresh = 0;
    for (const row of rows) {
      const key = rowKey(row);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      fresh += 1;
      const rating = toRating(row);
      if (rating) out.push(rating);
    }
    onProgress({ phase: "fetch", fetched: offset + out.length, message: `${label} page ${page}` });
    if (fresh === 0) break;
  }
  return out;
}

export const traktSource: RatingsSource = {
  id: "trakt",
  label: "Trakt",
  kind: "session",
  available: () => !!getSession(),
  fetchRatings: async (_input, onProgress, signal) => {
    onProgress({ phase: "auth" });
    throwIfAborted(signal);
    if (!getSession()) {
      throw new Error("Trakt is not connected. Connect your Trakt account in Settings, then run the import again.");
    }
    onProgress({ phase: "fetch", fetched: 0 });
    const movies = await fetchType("movies", "Movies", 0, onProgress, signal);
    const shows = await fetchType("shows", "Shows", movies.length, onProgress, signal);
    return [...movies, ...shows];
  },
};
