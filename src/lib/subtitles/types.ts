export type SubResult = {
  id: string;
  url: string;
  lang: string;
  langName?: string;
  title?: string;
  source: "wyzie" | "addon" | "opensubtitles" | "jimaku" | "embedded";
  format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
  encoding?: string;
  fps?: number;
  hearingImpaired?: boolean;
  forced?: boolean;
  release?: string;
  downloads?: number;
  hash?: string;
};

export type SubSearchQuery = {
  imdbId?: string;
  tmdbId?: string;
  stremioId?: string;
  type?: "movie" | "series";
  title?: string;
  season?: number;
  episode?: number;
  langs?: string[];
  videoHash?: string;
  videoSize?: number;
  filename?: string;
};
