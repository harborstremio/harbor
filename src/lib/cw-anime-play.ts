import { getAnimeCwId } from "@/lib/anime-cw-ids";
import { isDetectedAnime } from "@/lib/anime-detect";
import { aniZipByKitsu, pickEpisodeTitle } from "@/lib/providers/anizip";
import { resolveAnimeIdentity } from "@/lib/streams/anime-identity";
import type { PlayEpisode } from "@/lib/view";

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;

export type CwAnimeEpisodeQuery = {
  metaId: string;
  season?: number;
  episode?: number;
  name?: string | null;
  airDate?: string | null;
  imdbSeason?: number;
  imdbEpisode?: number;
  absoluteNumber?: number | null;
};

/**
 * True when a row can possibly be an anime. Cheap and local: a Cinemeta row
 * that is neither mapped nor already detected is an ordinary series, and must
 * not pay for an identity lookup.
 */
function looksAnime(metaId: string): boolean {
  if (ANIME_SCHEME.test(metaId)) return true;
  return getAnimeCwId(metaId) != null || isDetectedAnime(metaId);
}

/**
 * Resolve the episode identity a Continue Watching launch must hand to the
 * player.
 *
 * It goes through `resolveAnimeIdentity`, the same resolver the stream picker
 * uses, so a split series (Bleach TYBW, JoJo) lands on the cour that actually
 * aired the season rather than the row's own base entry. The result carries the
 * entry-relative stream id (what the picker queries) plus the provider
 * coordinates and title the trackers and the Discord presence need.
 */
export async function resolveCwAnimePlayEpisode(
  query: CwAnimeEpisodeQuery,
): Promise<PlayEpisode | null> {
  if (!looksAnime(query.metaId)) return null;
  const identity = await resolveAnimeIdentity(query.metaId, null, {
    season: query.season,
    episode: query.episode,
    imdbSeason: query.imdbSeason,
    imdbEpisode: query.imdbEpisode,
  }).catch(() => null);
  if (!identity) return null;
  const az = await aniZipByKitsu(identity.kitsuId).catch(() => null);
  const azEp = az?.episodes?.[String(identity.number)];
  return {
    season: query.season ?? 1,
    episode: query.episode ?? identity.number,
    name: pickEpisodeTitle(azEp) ?? query.name ?? undefined,
    still: azEp?.image ?? undefined,
    overview: azEp?.overview || undefined,
    kitsuStreamId: identity.streamId,
    // Name the cour the stream belongs to, so a tracker counts its episodes
    // instead of the parent series'.
    sourceMetaId: `kitsu:${identity.kitsuId}`,
    imdbId: az?.mappings?.imdb_id,
    imdbSeason: azEp?.seasonNumber ?? query.imdbSeason,
    imdbEpisode: azEp?.episodeNumber ?? query.imdbEpisode,
    absoluteNumber: azEp?.absoluteEpisodeNumber ?? query.absoluteNumber ?? undefined,
    tvdbEpisodeId: azEp?.tvdbId,
    airDate: azEp?.airDate ?? query.airDate ?? undefined,
    runtime: azEp?.runtime,
  };
}
