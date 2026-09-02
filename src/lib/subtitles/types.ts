import type { SubtitleMatchConfidence } from "./release-match";
import type { SubtitleMatchExplanation, SubtitleTimingStatus } from "./candidate-preflight";
import type { SubtitleDownloadAuth } from "./provider-auth";

export type ProviderMatchConfidence = "exact" | "high" | "medium" | "low" | "unknown";

/** Evidence reported by the provider or implied by a provider-side exact filter. */
export type ProviderMatchEvidence = {
  score?: number;
  confidence?: ProviderMatchConfidence;
  reasons?: string[];
  matchedBy?: Array<"hash" | "filename" | "id" | "episode" | "title" | "release">;
  degraded?: boolean;
};

export type SubtitleRating = {
  score?: number;
  good?: number;
  bad?: number;
  total?: number;
};

export type SubResult = {
  id: string;
  url: string;
  lang: string;
  langName?: string;
  title?: string;
  displayTitle?: string;
  source:
    | "wyzie"
    | "addon"
    | "opensubtitles"
    | "jimaku"
    | "podnapisi"
    | "subdl"
    | "gestdown"
    | "subsource";
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  fps?: number;
  hearingImpaired?: boolean;
  forced?: boolean;
  foreignOnly?: boolean;
  machineTranslated?: boolean;
  fromTrusted?: boolean;
  release?: string;
  downloads?: number;
  author?: string;
  uploadedAt?: string;
  rating?: SubtitleRating;
  productionType?: string;
  releaseType?: string;
  archive?: boolean;
  rawFilename?: string;
  fileSize?: number;
  checksum?: string;
  season?: number;
  episode?: number;
  langConfirmed?: boolean;
  episodeConfirmed?: boolean;
  idConfirmed?: boolean;
  providerMatch?: ProviderMatchEvidence;
  downloadAuth?: SubtitleDownloadAuth;
  upstreamProvider?: string;
  hash?: string;
  timingStatus?: SubtitleTimingStatus;
};

export type SubtitleLoadMetadata = {
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  release?: string;
  provider?: string;
  fps?: number;
  downloads?: number;
  author?: string;
  uploadedAt?: string;
  rating?: SubtitleRating;
  productionType?: string;
  releaseType?: string;
  archive?: boolean;
  rawFilename?: string;
  fileSize?: number;
  checksum?: string;
  season?: number;
  episode?: number;
  langConfirmed?: boolean;
  episodeConfirmed?: boolean;
  idConfirmed?: boolean;
  hearingImpaired?: boolean;
  forced?: boolean;
  foreignOnly?: boolean;
  machineTranslated?: boolean;
  fromTrusted?: boolean;
  providerMatch?: ProviderMatchEvidence;
  downloadAuth?: SubtitleDownloadAuth;
  providerDerived?: boolean;
  prepared?: boolean;
  autoSelectionEligible?: boolean;
  originalUrl?: string;
  timingStatus?: SubtitleTimingStatus;
  timingMeasurementStatus?: "measured" | "unknown";
  matchExplanation?: SubtitleMatchExplanation;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  matchReasons?: string[];
  subId?: string;
};

export type SubSearchQuery = {
  imdbId?: string;
  tmdbId?: string;
  stremioId?: string;
  candidateIds?: string[];
  type?: "movie" | "series";
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  langs?: string[];
  videoHash?: string;
  videoSize?: number;
  filename?: string;
};
