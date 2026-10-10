import type { RatingMediaType } from "@/lib/ratings/types";
import { SimklApiError, isSimklBlocked, simklRequest } from "@/lib/simkl/client";
import { getSession, isAuthenticated } from "@/lib/simkl/session";
import { isRated, normalizeScore, scoreIsValid } from "../types";
import type {
  ExternalIds,
  ImportProgress,
  ImportSourceInput,
  ImportedRating,
  RatingsSource,
} from "../types";

type BucketPath = "movies" | "shows" | "anime";

type Bucket = { path: BucketPath; mediaType: RatingMediaType; label: string };

type RawIds = {
  simkl?: number | string | null;
  imdb?: string | null;
  tmdb?: number | string | null;
  tvdb?: number | string | null;
  mal?: number | string | null;
  anidb?: number | string | null;
  anilist?: number | string | null;
  kitsu?: number | string | null;
  letterboxd?: string | null;
  slug?: string | null;
};

type RawNode = {
  title?: string | null;
  year?: number | string | null;
  poster?: string | null;
  ids?: RawIds | null;
};

type RawEntry = {
  user_rating?: number | string | null;
  user_rated_at?: string | null;
  movie?: RawNode | null;
  show?: RawNode | null;
};

type RawRatings = Partial<Record<BucketPath, RawEntry[] | null>>;

const ALL_RATINGS = "1,2,3,4,5,6,7,8,9,10";
const BUCKET_GAP_MS = 250;
const MAX_TITLE = 300;
const MAX_POSTER_PATH = 120;
const MIN_YEAR = 1800;
const MAX_YEAR = 2200;

const TCONST = /^tt\d+$/;
const POSTER_PATH = /^[A-Za-z0-9/_-]+$/;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

const NO_SESSION_MESSAGE = "No Simkl account connected. Connect Simkl in Settings first.";
const AUTH_MESSAGE = "Simkl sign-in expired. Reconnect your Simkl account in Settings.";
const BLOCKED_MESSAGE = "Simkl is rate limiting Harbor right now. Wait a minute and try again.";

const BUCKETS: Bucket[] = [
  { path: "movies", mediaType: "movie", label: "Movies" },
  { path: "shows", mediaType: "series", label: "Shows" },
  { path: "anime", mediaType: "anime", label: "Anime" },
];

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function numeric(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function positiveInt(value: number | string | null | undefined): number | null {
  const n = numeric(value);
  return n != null && Number.isInteger(n) && n > 0 ? n : null;
}

function tconst(value: string | null | undefined): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return TCONST.test(s) ? s : null;
}

function slugOf(value: string | null | undefined): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return SLUG.test(s) ? s : null;
}

function yearOf(value: number | string | null | undefined): number | undefined {
  const n = positiveInt(value);
  return n != null && n >= MIN_YEAR && n <= MAX_YEAR ? n : undefined;
}

function posterUrl(fragment: string | null | undefined): string | undefined {
  const s = typeof fragment === "string" ? fragment.trim() : "";
  if (!s || s.length > MAX_POSTER_PATH || !POSTER_PATH.test(s)) return undefined;
  return `https://simkl.in/posters/${s}_m.jpg`;
}

function ratedAtOf(value: string | null | undefined): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

export function externalIds(raw: RawIds | null | undefined): ExternalIds {
  const ids: ExternalIds = {};
  if (!raw) return ids;

  const imdb = tconst(raw.imdb);
  if (imdb) ids.imdb = imdb;

  const tmdb = positiveInt(raw.tmdb);
  if (tmdb != null) ids.tmdb = tmdb;

  const tvdb = positiveInt(raw.tvdb);
  if (tvdb != null) ids.tvdb = tvdb;

  const mal = positiveInt(raw.mal);
  if (mal != null) ids.mal = mal;

  const anilist = positiveInt(raw.anilist);
  if (anilist != null) ids.anilist = anilist;

  const kitsu = positiveInt(raw.kitsu);
  if (kitsu != null) ids.kitsu = kitsu;

  const anidb = positiveInt(raw.anidb);
  if (anidb != null) ids.anidb = anidb;

  const simkl = positiveInt(raw.simkl);
  if (simkl != null) ids.simkl = simkl;

  const letterboxd = slugOf(raw.letterboxd);
  if (letterboxd) ids.letterboxd = letterboxd;

  const slug = slugOf(raw.slug);
  if (slug) ids.slug = slug;

  return ids;
}

export function toRating(entry: RawEntry, bucket: Bucket): ImportedRating | null {
  const node = entry.movie ?? entry.show;
  if (!node) return null;

  const title = typeof node.title === "string" ? node.title.trim() : "";
  if (!title) return null;

  const raw = numeric(entry.user_rating);
  if (raw == null || !isRated(raw)) return null;

  const score = normalizeScore(raw, "point10");
  if (!scoreIsValid(score)) return null;

  return {
    sourceId: "simkl",
    score,
    mediaType: bucket.mediaType,
    title: title.slice(0, MAX_TITLE),
    year: yearOf(node.year),
    poster: posterUrl(node.poster),
    ids: externalIds(node.ids),
    ratedAt: ratedAtOf(entry.user_rated_at),
  };
}

export function parseBucket(data: RawRatings | null | undefined, bucket: Bucket): ImportedRating[] {
  const rows = data?.[bucket.path];
  if (!Array.isArray(rows)) return [];
  const out: ImportedRating[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rating = toRating(row, bucket);
    if (rating) out.push(rating);
  }
  return out;
}

function friendlyError(err: unknown): Error {
  if (err instanceof SimklApiError) {
    if (err.status === 401 || err.status === 403) return new Error(AUTH_MESSAGE);
    if (err.status === 412 || err.status === 429) return new Error(BLOCKED_MESSAGE);
    return new Error(`Simkl request failed (HTTP ${err.status}). Try again in a few minutes.`);
  }
  if (err instanceof Error) return err;
  return new Error("Simkl request failed. Try again in a few minutes.");
}

async function requestBucket(bucket: Bucket, signal?: AbortSignal): Promise<RawRatings> {
  throwIfAborted(signal);
  try {
    return await simklRequest<RawRatings>(`/sync/ratings/${bucket.path}/${ALL_RATINGS}`);
  } catch (err) {
    if (isAbort(err)) throw err;
    throw friendlyError(err);
  }
}

function available(): boolean {
  return isAuthenticated();
}

async function fetchRatings(
  _input: ImportSourceInput,
  onProgress: (p: Partial<ImportProgress>) => void,
  signal?: AbortSignal,
): Promise<ImportedRating[]> {
  throwIfAborted(signal);
  onProgress({ phase: "auth" });
  if (!getSession()) throw new Error(NO_SESSION_MESSAGE);
  if (isSimklBlocked()) throw new Error(BLOCKED_MESSAGE);

  const out: ImportedRating[] = [];
  onProgress({ phase: "fetch", fetched: 0 });

  for (let i = 0; i < BUCKETS.length; i += 1) {
    const bucket = BUCKETS[i];
    const data = await requestBucket(bucket, signal);
    out.push(...parseBucket(data, bucket));
    onProgress({ phase: "fetch", fetched: out.length, message: bucket.label });
    if (i + 1 < BUCKETS.length) await wait(BUCKET_GAP_MS, signal);
  }

  return out;
}

export const simklSource: RatingsSource = {
  id: "simkl",
  label: "Simkl",
  kind: "session",
  available,
  fetchRatings,
};
