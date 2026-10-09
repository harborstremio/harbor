export type ExternalShowIds = {
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
  trakt?: number;
  slug?: string;
};

export type EpisodeIdentity = {
  showTitle: string;
  showYear?: number | null;
  season: number;
  number: number;
  name?: string | null;
  airDate?: string | null;
  episodeTvdbId?: number | null;
  episodeImdbId?: string | null;
};

export type EpisodeCandidate = {
  number: number;
  title?: string | null;
  airDate?: string | null;
  tvdbId?: number | null;
  imdbId?: string | null;
};

export type SeasonListing = {
  number: number;
  episodes: EpisodeCandidate[];
};

export type ResolvedEpisode = {
  showIds: ExternalShowIds;
  season: number;
  number: number;
};

export type ResolutionResult =
  | { ok: true; episode: ResolvedEpisode }
  | { ok: false; reason: "not-found" | "error" };
