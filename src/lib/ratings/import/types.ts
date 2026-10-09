import type { RatingMediaType } from "@/lib/ratings/types";

export type ImportSourceId =
  | "trakt"
  | "simkl"
  | "anilist"
  | "mal"
  | "mdblist"
  | "imdb"
  | "letterboxd"
  | "tmdb";

export type ImportKind = "session" | "file" | "key";

export type ExternalIds = {
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  trakt?: number;
  mal?: number;
  anilist?: number;
  kitsu?: number;
  anidb?: number;
  simkl?: number;
  letterboxd?: string;
  mdl?: string;
  slug?: string;
};

export type ImportedRating = {
  sourceId: ImportSourceId;
  score: number;
  mediaType: RatingMediaType;
  title: string;
  year?: number;
  poster?: string;
  review?: string;
  ids: ExternalIds;
  ratedAt?: number;
};

export type ImportPhase = "auth" | "fetch" | "resolve" | "write" | "done";

export type ImportProgress = {
  phase: ImportPhase;
  fetched: number;
  total?: number;
  resolved: number;
  written: number;
  failed: number;
  message?: string;
};

export type ImportSourceInput = {
  file?: File;
  apiKey?: string;
  username?: string;
};

export type RatingsSource = {
  id: ImportSourceId;
  label: string;
  kind: ImportKind;
  available: () => boolean | Promise<boolean>;
  fetchRatings: (
    input: ImportSourceInput,
    onProgress: (p: Partial<ImportProgress>) => void,
    signal?: AbortSignal,
  ) => Promise<ImportedRating[]>;
};

export type ScoreScale =
  | "point10"
  | "point100"
  | "point10decimal"
  | "point5"
  | "point3"
  | "tmdb";

const SCALE_FACTOR: Record<ScoreScale, number> = {
  point10: 1,
  point100: 1 / 10,
  point10decimal: 1,
  point5: 2,
  point3: 10 / 3,
  tmdb: 1,
};

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

export function isRated(raw: number | null | undefined): boolean {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0;
}

export function normalizeScore(raw: number, scale: ScoreScale): number {
  if (!Number.isFinite(raw)) return MIN_SCORE;
  const scaled = Math.round(raw * SCALE_FACTOR[scale]);
  if (scaled < MIN_SCORE) return MIN_SCORE;
  if (scaled > MAX_SCORE) return MAX_SCORE;
  return scaled;
}

export function scoreIsValid(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_SCORE && n <= MAX_SCORE;
}
