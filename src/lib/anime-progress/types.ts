/**
 * Provider-neutral anime progress model.
 *
 * Every tracker adapter (Trakt / Simkl / MAL / AniList) normalizes into this
 * representation. Pure selection logic in `normalize.ts` never touches the
 * network, so it stays unit-testable without provider credentials.
 */

/** Where an imported Continue Watching candidate came from. */
export type AnimeProgressSource = "trakt" | "simkl" | "mal" | "anilist" | "merged";

/**
 * - `exact`: the provider reported concrete watched episodes (Trakt / Simkl).
 * - `inferred`: the provider only reported a watched-episode count, so the
 *   next episode is `count + 1` (MAL / AniList).
 */
export type AnimeProgressKind = "exact" | "inferred";

/** External ids known for one anime, used for ID resolution. */
export type AnimeProgressIds = {
  mal?: number | null;
  anilist?: number | null;
  kitsu?: number | null;
  anidb?: number | null;
  trakt?: number | null;
  simkl?: number | null;
  imdb?: string | null;
  tmdb?: number | null;
  tvdb?: number | null;
};

/**
 * One anime's watching progress from a single provider, normalized.
 *
 * `watchedEpisodes` is only set for `exact` entries (`"season:episode"`).
 * `watchedCount` is the provider's watched-episode total and is the basis for
 * `inferred` entries. `totalEpisodes` may be null when the provider (or the
 * airing show itself) does not know the final count yet.
 */
export type NormalizedAnimeProgress = {
  /** Stable dedupe key, e.g. `mal:21` / `anilist:21`. */
  key: string;
  source: AnimeProgressSource;
  kind: AnimeProgressKind;
  /** Raw provider status string, e.g. `watching`, `CURRENT`. */
  status: string;
  /** True only for an active "Watching" equivalent status. */
  watching: boolean;
  watchedEpisodes: Set<string> | null;
  watchedCount: number | null;
  totalEpisodes: number | null;
  ids: AnimeProgressIds;
  titles: string[];
  year: number | null;
  updatedAt: string | null;
};

/** A resolved next-episode candidate before Stremio metadata resolution. */
export type NextEpisodeCandidate = {
  season: number;
  episode: number;
  kind: AnimeProgressKind;
  source: AnimeProgressSource;
  /** Stremio metadata ids to try, in preference order. */
  candidates: string[];
  title: string;
  poster?: string;
  updatedAt: string | null;
};

/** Why an anime produced no Continue Watching entry. */
export type AnimeProgressSkipReason =
  | "not-watching"
  | "completed"
  | "no-progress"
  | "no-mapping"
  | "ambiguous"
  | "unreleased"
  | "no-metadata";

export type AnimeProgressDecision =
  | { kind: "next"; candidate: NextEpisodeCandidate }
  | { kind: "skip"; reason: AnimeProgressSkipReason };

/**
 * Cross-provider disagreement record. planGroup resolves disagreements itself
 * (the earliest proposed episode wins, so a show is never dropped) and returns
 * the resolution as an entry note instead; kept for a future reporting UI.
 */
export type AnimeProgressConflict = {
  key: string;
  titles: string[];
  sources: AnimeProgressSource[];
  detail: string;
};
