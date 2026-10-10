import { activeProfileId } from "@/lib/active-profile-id";
import { getSession } from "./session";
import { resolveForMeta } from "@/lib/tracker-resolve";
import { resolveSimklEpisodeTarget, stremioIdToSimklTarget } from "./ids";
import {
  addToHistory,
  markAnimeEpisodesWatched,
  markEpisodesWatched,
  markTvdbAnimeEpisodesWatched,
} from "./history";
import { isDetectedAnime } from "@/lib/anime-detect";
import { animeEntryTarget } from "@/lib/anime-entry-target";
import { kitsuToMal } from "@/lib/providers/anime-mapping";
import type { ScrobbleInfo } from "./scrobble-body";
import type { PlayerSrc } from "@/lib/view";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

/**
 * Directly records the finished item in Simkl's watch history as a fallback,
 * because the beacon is fire-and-forget and would otherwise leave the item
 * stuck in "watching" if its request is ever lost.
 *
 * Returns true when the write was confirmed so callers can persist the intent
 * for a later retry instead of dropping it.
 */
export async function recordWatchedFallback(
  metaId: string,
  episode: PlayerSrc["episode"] | undefined,
  info?: ScrobbleInfo,
): Promise<boolean> {
  const profile = activeProfileId();
  const session = getSession();
  const owned = () => session != null && getSession() === session && activeProfileId() === profile;
  if (!owned()) return false;
  if (episode && metaId.startsWith("tt") && isDetectedAnime(metaId)) {
    // An IMDb-opened episode's own season/episode already are the TVDB pair.
    const t = await animeEntryTarget(metaId, {
      number: episode.episode,
      seasonNumber: episode.season,
      imdbId: episode.imdbId,
      imdbSeason: episode.imdbSeason ?? episode.season,
      imdbEpisode: episode.imdbEpisode ?? episode.episode,
      streamId: episode.kitsuStreamId,
    });
    const mal = t ? await kitsuToMal(t.kitsuId).catch(() => null) : null;
    if (!owned()) return false;
    if (t) {
      const ids = mal != null ? { kitsu: t.kitsuId, mal } : { kitsu: t.kitsuId };
      return markAnimeEpisodesWatched(ids, [t.number]);
    }
    // Without a Kitsu entry only Simkl's TVDB-anime mapping can place it; plain shows[] never matches.
    const season = episode.imdbSeason ?? episode.season;
    const number = episode.imdbEpisode ?? episode.episode;
    return markTvdbAnimeEpisodesWatched({ imdb: metaId.split(":")[0] }, season, [number]);
  }
  const r = stremioIdToSimklTarget(metaId, episode);
  const t = r.ok
    ? r.target
    : episode
      ? await resolveSimklEpisodeTarget(metaId, episode, info?.imdb)
      : null;
  if (!owned() || !t) return false;
  if (t.kind === "episode") {
    if (await markEpisodesWatched(t.show.ids, t.season, [t.number])) return true;
    if (!owned() || ANIME_ID.test(metaId)) return false;
    const resolved = await resolveForMeta(metaId, t.season, t.number);
    if (!owned() || !resolved.ok) return false;
    return markEpisodesWatched(resolved.episode.showIds, resolved.episode.season, [
      resolved.episode.number,
    ]);
  }
  if (t.kind === "anime-episode") return markEpisodesWatched(t.anime.ids, t.season, [t.number]);
  return addToHistory(t, metaId);
}
