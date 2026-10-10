import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { EpisodeDetailPlayback, PlayEpisode } from "@/lib/view";
import { animeRowSeason } from "@/lib/anime-stremio-watched";

export function animeSeasonKey(ep: KitsuEpisode): number {
  return animeRowSeason(ep);
}

export type AnimeDetailTarget = {
  seriesId: string;
  season: number;
  episode: number;
  seriesMeta: Meta;
  playback: EpisodeDetailPlayback;
};

export function animePlayEpisode(ep: KitsuEpisode): PlayEpisode {
  return {
    season: animeSeasonKey(ep),
    episode: ep.number,
    name: ep.title,
    still: ep.thumbnail ?? undefined,
    overview: ep.synopsis || undefined,
    kitsuStreamId: ep.streamId,
    sourceMetaId: ep.sourceMetaId,
    imdbId: ep.imdbId,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
    absoluteNumber: ep.absoluteNumber ?? ep.number,
    tvdbEpisodeId: ep.tvdbEpisodeId,
    airDate: ep.airdate ?? undefined,
    runtime: ep.length ?? undefined,
  };
}

function isResolvableSeriesId(id: string): boolean {
  return id.startsWith("tt") || id.startsWith("tmdb:tv:");
}

// Resolve the episode-detail target for an anime episode without mutating
// display/play/watched identifiers (ep.number, animeSeasonKey).
// A Kitsu entry needs a complete mapping before querying another provider.
// Preserve its playback identity and the original page for Back navigation.
export function resolveAnimeDetailTarget(
  ep: KitsuEpisode,
  parentMeta: Meta,
  epMeta: Meta,
): AnimeDetailTarget {
  const canonicalSeason = ep.imdbSeason ?? animeSeasonKey(ep);
  const canonicalEpisode = ep.imdbEpisode ?? ep.number;
  const canonicalId =
    (ep.imdbId?.startsWith("tt") ? ep.imdbId : null) ??
    (isResolvableSeriesId(epMeta.id) ? epMeta.id : null) ??
    (isResolvableSeriesId(parentMeta.id) ? parentMeta.id : null);
  const playback = { meta: epMeta, episode: animePlayEpisode(ep) };
  const mapped = ep.imdbSeason != null && ep.imdbEpisode != null;
  if (canonicalId && (mapped || (ep.id < 0 && canonicalId === epMeta.id))) {
    return {
      seriesId: canonicalId,
      season: canonicalSeason,
      episode: canonicalEpisode,
      seriesMeta: parentMeta,
      playback,
    };
  }
  return {
    seriesId: epMeta.id,
    season: animeSeasonKey(ep),
    episode: ep.number,
    seriesMeta: parentMeta,
    playback,
  };
}
