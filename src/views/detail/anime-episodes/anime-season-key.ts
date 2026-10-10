import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { splitFranchiseDisplaySeason } from "@/lib/streams/anime-identity-core";
import type { EpisodeDetailPlayback, PlayEpisode } from "@/lib/view";

export function animeSeasonKey(ep: KitsuEpisode): number {
  if (ep.imdbSeason === 0) return 0;
  return ep.id < 0 ? (ep.imdbSeason ?? ep.seasonNumber ?? 1) : (ep.seasonNumber ?? 1);
}

/** Whether an episode belongs to the resume's season (either numbering). */
export function episodeInResumeSeason(ep: KitsuEpisode, season: number): boolean {
  if (animeSeasonKey(ep) === season) return true;
  return ep.imdbSeason != null && ep.imdbSeason === season;
}

/** Whether the pool represents the given resume season at all. */
export function poolHasSeason(episodes: KitsuEpisode[], season: number): boolean {
  return episodes.some((e) => episodeInResumeSeason(e, season));
}

/**
 * Find the pool episode a resume entry points at. The episode's season must
 * agree with the resume: episode numbers repeat across seasons (JoJo's part 1
 * has an E3 while the resume can point at Steel Ball Run's E3), and matching on
 * the number alone elects the wrong season for the whole page.
 */
export function matchPlayedEpisode(
  episodes: KitsuEpisode[],
  played: { season: number; episode: number; displaySeason?: number } | null,
  playedId: string | null,
  metaId: string,
  partScoped: boolean,
): KitsuEpisode | undefined {
  if (!played) return undefined;
  const agrees = (e: KitsuEpisode) => episodeInResumeSeason(e, played.season);
  if (playedId != null) {
    const byEntry = episodes.find(
      (e) => e.number === played.episode && (e.sourceMetaId ?? metaId) === playedId && agrees(e),
    );
    if (byEntry) return byEntry;
  }
  if (partScoped && played.displaySeason != null) {
    const byPart = episodes.find(
      (e) =>
        e.number === played.episode &&
        splitFranchiseDisplaySeason(parseKitsuId(e.sourceMetaId ?? "")) === played.displaySeason &&
        agrees(e),
    );
    if (byPart) return byPart;
  }
  return episodes.find((e) => e.number === played.episode && agrees(e));
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
