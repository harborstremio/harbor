import type { SubtitleMatchConfidence } from "./release-match";

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
  release?: string;
  downloads?: number;
  author?: string;
  upstreamProvider?: string;
  hash?: string;
};

export type SubtitleLoadMetadata = {
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  release?: string;
  provider?: string;
  fps?: number;
  downloads?: number;
  author?: string;
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
  season?: number;
  episode?: number;
  langs?: string[];
  videoHash?: string;
  videoSize?: number;
  filename?: string;
};
