import type { DebridSlug, Tier } from "../types";

export type ScoreOptions = {
  activeDebrids: DebridSlug[];
  preferredLanguages?: string[];
  bandwidthMbps?: number;
  releaseDate?: string | null;
  mediaKind?: "movie" | "series";
  runtimeMinutes?: number;
  inTheaters?: boolean;
  preferSingleAudioTrack?: boolean;
  preferAddonId?: string;
  preferredReleaseGroup?: string;
  respectAddonOrder?: boolean;
};

export type CorpusStats = {
  daysSinceRelease: number | null;
  trustedTrackedFraction: number;
  theaterCaptureFraction: number;
  webishFraction: number;
  trustedTrackedCount: number;
};

export const TRACKING_MIN_SEEDERS = 30;

export const TIER_ORDER: Tier[] = [
  "4K_DV",
  "4K_HDR",
  "4K",
  "1080p_HDR",
  "1080p",
  "720p",
  "SD",
  "ROUGH",
];
