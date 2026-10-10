import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import type { EpisodeRef, PlayInvite } from "./protocol";

export function toEpisodeRef(ep: PlayEpisode): EpisodeRef {
  return {
    season: ep.season,
    episode: ep.episode,
    name: ep.name,
    kitsuStreamId: ep.kitsuStreamId,
    imdbId: ep.imdbId,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
    absoluteNumber: ep.absoluteNumber,
    tvdbEpisodeId: ep.tvdbEpisodeId,
  };
}

export function buildPlayInvite(meta: Meta, episode?: PlayEpisode): PlayInvite {
  return {
    mediaId: meta.id,
    mediaType: meta.type === "series" ? "series" : "movie",
    mediaTitle: meta.name,
    releaseInfo: meta.releaseInfo,
    posterUrl: meta.poster,
    backgroundUrl: meta.background,
    logoUrl: meta.logo,
    episode: episode ? toEpisodeRef(episode) : undefined,
  };
}
