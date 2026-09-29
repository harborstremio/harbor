import { airedOnly } from "@/lib/aired";
import type { PlayEpisode } from "@/lib/view";

export type DownloadEpisode = PlayEpisode & { watched: boolean };

export function availableDownloadEpisodes(episodes: DownloadEpisode[]): DownloadEpisode[] {
  const sorted = episodes
    .filter((ep) => ep.season >= 1 && ep.episode >= 1)
    .slice()
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  return airedOnly(sorted, (ep) => ep.airDate);
}

// Match Harbor's Resume target first, including an in-progress episode that a
// tracking service may already report as watched. Otherwise start at the first
// unwatched episode rather than skipping earlier gaps based on tracking data.
export function remainingEpisodeIndex(
  episodes: DownloadEpisode[],
  resumeTarget?: { season: number; episode: number },
): number {
  if (resumeTarget) {
    const displayIndex = episodes.findIndex(
      (ep) => ep.season === resumeTarget.season && ep.episode === resumeTarget.episode,
    );
    if (displayIndex >= 0) return displayIndex;

    const canonicalIndex = episodes.findIndex(
      (ep) => ep.imdbSeason === resumeTarget.season && ep.imdbEpisode === resumeTarget.episode,
    );
    if (canonicalIndex >= 0) return canonicalIndex;
  }

  const firstUnwatched = episodes.findIndex((ep) => !ep.watched);
  return firstUnwatched >= 0 ? firstUnwatched : episodes.length;
}

export function episodeRange<T>(episodes: T[], start: number, end: number): T[] {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end >= episodes.length
  )
    return [];
  return episodes.slice(start, end + 1);
}

export function remainingSeasonRange(
  episodes: DownloadEpisode[],
  season: number | undefined,
  resumeTarget?: { season: number; episode: number },
): { start: number; end: number } {
  const currentSeason = season ?? episodes[remainingEpisodeIndex(episodes, resumeTarget)]?.season;
  const indices = episodes.flatMap((ep, index) => (ep.season === currentSeason ? [index] : []));
  const seasonEpisodes = indices.map((index) => episodes[index]!);
  const localStart = remainingEpisodeIndex(seasonEpisodes, resumeTarget);
  return {
    start: indices[localStart] ?? episodes.length,
    end: indices.at(-1) ?? -1,
  };
}

export function endsInFinalSeason(end: PlayEpisode | undefined, episodes: PlayEpisode[]): boolean {
  return (
    !!end && episodes.length > 0 && end.season === Math.max(...episodes.map((ep) => ep.season))
  );
}

export function requiresPerEpisodeDownload(episodes: PlayEpisode[]): boolean {
  return (
    new Set(episodes.map((ep) => ep.imdbSeason ?? ep.season)).size > 1 ||
    new Set(episodes.map((ep) => ep.sourceMetaId ?? null)).size > 1
  );
}
