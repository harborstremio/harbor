import { countNextStatus, nextAfterCount, nextAfterExact, stremioCandidates } from "./normalize";
import type { AnimeProgressSkipReason, NextEpisodeCandidate, NormalizedAnimeProgress } from "./types";
import type { CatalogOpts, EpisodeCatalog } from "./normalize";

export type NextEpisodeInput = {
  progress: NormalizedAnimeProgress;
  catalog?: EpisodeCatalog | null;
  includeSpecials?: boolean;
  episodeTitle?: (season: number, episode: number) => string | null;
};

function hasUnreleasedAfter(watched: Set<string>, catalog: EpisodeCatalog): boolean {
  const now = Date.now();
  for (const key of catalog.episodes) {
    if (watched.has(key)) continue;
    const air = catalog.airDates.get(key);
    if (air != null && air > now) return true;
  }
  return false;
}

export function decideNextEpisode(input: NextEpisodeInput): NextEpisodeCandidate | { skip: AnimeProgressSkipReason } {
  const { progress, catalog } = input;
  const opts: CatalogOpts = { includeSpecials: input.includeSpecials, episodeTitle: input.episodeTitle };
  if (!progress.watching) return { skip: "not-watching" };
  // A non-positive total means the provider does not know the count (MAL and
  // AniList report 0 for airing shows), not that the show has no episodes —
  // completion is decided by the catalog instead.
  const total =
    progress.totalEpisodes != null && progress.totalEpisodes > 0 ? progress.totalEpisodes : null;
  const candidates = stremioCandidates(progress.ids);
  if (candidates.length === 0) return { skip: "no-mapping" };
  const title = progress.titles[0] ?? progress.key;
  const base = { candidates, title, updatedAt: progress.updatedAt };

  if (progress.kind === "exact") {
    const watched = progress.watchedEpisodes ?? new Set<string>();
    const count = progress.watchedCount ?? watched.size;
    if (watched.size === 0 && count <= 0) return { skip: "no-progress" };
    if (!catalog || catalog.episodes.size === 0) {
      if (count <= 0) return { skip: "no-progress" };
      const episode = Math.floor(count) + 1;
      if (total != null && episode > total) return { skip: "completed" };
      return { season: 1, episode, kind: "inferred", source: progress.source, ...base };
    }
    const next = nextAfterExact(watched, catalog, opts);
    if (!next) return { skip: hasUnreleasedAfter(watched, catalog) ? "unreleased" : "completed" };
    return { season: next.season, episode: next.episode, kind: "exact", source: progress.source, ...base };
  }

  const count = progress.watchedCount ?? 0;
  if (count <= 0) return { skip: "no-progress" };
  if (total != null && count >= total) return { skip: "completed" };
  if (!catalog || catalog.episodes.size === 0) {
    return { season: 1, episode: Math.floor(count) + 1, kind: "inferred", source: progress.source, ...base };
  }
  const next = nextAfterCount(count, catalog, opts);
  if (!next) {
    // The count either exhausted the aired catalog (a completed show) or landed
    // on an episode that has not aired yet; report the two states distinctly.
    return { skip: countNextStatus(count, catalog, opts) === "completed" ? "completed" : "unreleased" };
  }
  return { season: next.season, episode: next.episode, kind: "inferred", source: progress.source, ...base };
}
