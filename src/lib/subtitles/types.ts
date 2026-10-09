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
  /** Free-form row label from the source addon (e.g. a translating addon's "Make <lang> • <variant>"). */
  label?: string;
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
  /**
   * The source advertises that the same URL can later serve a richer/updated file
   * (AI translation addons). Engines use it to treat a not-ready payload as pending
   * and to replace a previous track for the same source instead of duplicating it.
   */
  refreshable?: boolean;
  timingStatus?: SubtitleTimingStatus;
  timingMeasurementStatus?: "measured" | "unknown";
  matchExplanation?: SubtitleMatchExplanation;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  matchReasons?: string[];
  subId?: string;
};

/**
 * A language group whose "language" is really a generated translation offer from an
 * addon (e.g. "Make Hindi") rather than a real language code. Surfaced so the subtitle
 * panel can offer these without the user having to open the search pane first.
 */
export type GeneratedSubtitleGroup = {
  /** Group key as rendered in search results, e.g. "MAKE HINDI". */
  key: string;
  /** Friendly display label, e.g. "Make Hindi". */
  label: string;
  count: number;
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
