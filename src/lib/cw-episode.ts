import type { AniZipMapping } from "./providers/anizip";

type EpisodeNumber = { season: number; episode: number };

type EpisodeMappingTarget = EpisodeNumber & {
  kitsuStreamId?: string;
  imdbId?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
};

export function formatCwEpisodeLabel(input: {
  mapped?: EpisodeNumber | null;
  episode?: EpisodeNumber | null;
  animeEpisode?: number | null;
}): string {
  if (input.mapped) {
    return `S${input.mapped.season} · E${String(input.mapped.episode).padStart(2, "0")}`;
  }
  if (input.episode) return `S${input.episode.season}E${input.episode.episode}`;
  if (input.animeEpisode != null && Number.isFinite(input.animeEpisode) && input.animeEpisode > 0) {
    return `Ep ${input.animeEpisode}`;
  }
  return "";
}

export function applyAniZipEpisodeMapping(
  episode: EpisodeMappingTarget,
  mapping: AniZipMapping | null,
): void {
  if (!mapping) return;
  const mappedEpisode = mapping.episodes?.[String(episode.episode)];
  if (mapping.mappings?.kitsu_id) {
    episode.kitsuStreamId = `kitsu:${mapping.mappings.kitsu_id}:${episode.episode}`;
  }
  if (mapping.mappings?.imdb_id) episode.imdbId = mapping.mappings.imdb_id;
  if (mappedEpisode?.seasonNumber != null && mappedEpisode.episodeNumber != null) {
    episode.imdbSeason = mappedEpisode.seasonNumber;
    episode.imdbEpisode = mappedEpisode.episodeNumber;
  }
}
