import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { DownloadEpisode } from "./episode-range";

export type AnimeDownloadEpisode = {
  episode: KitsuEpisode;
  season: number;
  number: number;
};

export function animeDownloadResumeTarget(
  entries: AnimeDownloadEpisode[],
  nativeEpisodes: KitsuEpisode[],
  target: { season: number; episode: number } | undefined,
): { season: number; episode: number } | undefined {
  if (!target) return undefined;
  const native = nativeEpisodes.find(
    (ep) => ep.seasonNumber === target.season && ep.number === target.episode,
  );
  if (!native) return target;
  const entry = entries.find((item) => item.episode.id === native.id);
  return entry ? { season: entry.season, episode: entry.number } : undefined;
}

export function animeDownloadEpisodes(
  entries: AnimeDownloadEpisode[],
  watched: (episode: KitsuEpisode) => boolean,
  imdbId?: string | null,
): DownloadEpisode[] {
  return entries.map(({ episode: ep, season, number }) => ({
    season,
    episode: number,
    name: ep.title || undefined,
    kitsuStreamId: ep.streamId,
    imdbId: ep.imdbId ?? imdbId ?? undefined,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
    tvdbEpisodeId: ep.tvdbEpisodeId,
    sourceMetaId: ep.sourceMetaId,
    airDate: ep.airdate ?? undefined,
    runtime: ep.length ?? undefined,
    watched: watched(ep),
  }));
}
