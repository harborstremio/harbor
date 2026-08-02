import type { ScoredStream } from "../streams/types";
import { episodeVariantMatch } from "../streams/episode-file.ts";
import type { PlayEpisode } from "../view";

type SeasonPackCandidate = Pick<ScoredStream, "infoHash" | "season" | "seasonPack">;

export function isDownloadableSeasonPack(
  stream: SeasonPackCandidate,
  season?: number | null,
): boolean {
  if (!stream.seasonPack || typeof stream.infoHash !== "string" || stream.infoHash.length === 0) {
    return false;
  }
  return season == null || stream.season == null || stream.season === season;
}

export function downloadableSeasonPacks<T extends SeasonPackCandidate>(
  streams: T[],
  season?: number | null,
): T[] {
  return streams.filter((stream) => isDownloadableSeasonPack(stream, season));
}

export function streamForSeasonPackEpisode(stream: ScoredStream): ScoredStream {
  return {
    ...stream,
    url: undefined,
    externalUrl: undefined,
    ytId: undefined,
    nzbUrl: undefined,
    fileIdx: undefined,
    size: null,
    behaviorHints: stream.behaviorHints
      ? {
          ...stream.behaviorHints,
          filename: undefined,
          fileName: undefined,
          videoSize: undefined,
        }
      : undefined,
  };
}

export function seasonPackFileMatchesEpisode(filename: string, episode: PlayEpisode): boolean {
  return episodeVariantMatch(
    filename,
    episode.imdbSeason ?? episode.season ?? null,
    episode.imdbEpisode ?? episode.episode,
  );
}
