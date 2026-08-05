export type SubResult = {
  id: string;
  url: string;
  lang: string;
  langName?: string;
  title?: string;
  source: "wyzie" | "addon" | "opensubtitles" | "jimaku" | "podnapisi" | "subdl" | "gestdown" | "subsource";
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  fps?: number;
  hearingImpaired?: boolean;
  forced?: boolean;
  release?: string;
  downloads?: number;
  hash?: string;
};

export type SubtitleLoadMetadata = {
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  release?: string;
  provider?: string;
  matchScore?: number;
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
