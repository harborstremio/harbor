import { activeProfileId } from "@/lib/active-profile-id";
import { getSession } from "./session";
import { resolveForMeta } from "@/lib/tracker-resolve";
import { simklRequest } from "./client";
import { isDetectedAnime } from "@/lib/anime-detect";
import { animeEntryTarget } from "@/lib/anime-entry-target";
import { kitsuToMal } from "@/lib/providers/anime-mapping";
import {
  buildBody,
  buildEpisodeBody,
  type EpisodeRef,
  type ScrobbleAction,
  type ScrobbleInfo,
} from "./scrobble-body";

export { buildBody };
export type { EpisodeRef, ScrobbleAction, ScrobbleInfo };

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

async function post(action: ScrobbleAction, body: Record<string, unknown>): Promise<boolean> {
  try {
    await simklRequest(`/scrobble/${action}`, { method: "POST", body });
    return true;
  } catch {
    // Background-safe: live scrobble failures must never break playback.
    return false;
  }
}

/**
 * Simkl numbers a merged show differently from Cinemeta when the source keeps the
 * continuation as its own entry, so a rejected write is retried against the season
 * Simkl actually holds. Anime is excluded: its ids come from Kitsu/MAL, not from the
 * English-title catalog this resolves against.
 */
async function fallbackBody(
  metaId: string,
  episode: EpisodeRef,
  progress: number,
): Promise<Record<string, unknown> | null> {
  if (ANIME_ID.test(metaId) || isDetectedAnime(metaId)) return null;
  const season = episode?.season;
  const number = episode?.episode;
  if (season == null || number == null) return null;
  const resolved = await resolveForMeta(metaId, season, number);
  if (!resolved.ok) return null;
  return buildEpisodeBody(
    { ...resolved.episode.showIds },
    resolved.episode.season,
    resolved.episode.number,
    progress,
  );
}

// Anime opened by IMDb id: Simkl rejects its TVDB season, so send the entry's own episode number.
async function animeScrobbleBody(
  metaId: string,
  episode: EpisodeRef,
  progress: number,
): Promise<Record<string, unknown> | null> {
  if (!metaId.startsWith("tt") || !isDetectedAnime(metaId) || episode?.episode == null) return null;
  // An IMDb-opened episode's own season/episode already are the TVDB pair.
  const target = await animeEntryTarget(metaId, {
    number: episode.episode,
    seasonNumber: episode.season ?? 1,
    imdbId: episode.imdbId,
    imdbSeason: episode.imdbSeason ?? episode.season,
    imdbEpisode: episode.imdbEpisode ?? episode.episode,
  });
  if (!target) return null;
  const mal = await kitsuToMal(target.kitsuId).catch(() => null);
  const ids: Record<string, number> = { kitsu: target.kitsuId };
  if (mal != null) ids.mal = mal;
  return {
    progress: Math.min(100, Math.max(0, progress)),
    anime: { ids },
    episode: { number: target.number },
  };
}

export async function simklScrobble(
  action: ScrobbleAction,
  metaId: string,
  episode: EpisodeRef,
  progress: number,
  info?: ScrobbleInfo,
): Promise<boolean> {
  const profile = activeProfileId();
  const session = getSession();
  const owned = () => session != null && getSession() === session && activeProfileId() === profile;
  if (!owned()) return false;
  const anime = await animeScrobbleBody(metaId, episode, progress);
  if (!owned()) return false;
  if (anime && (await post(action, anime))) return true;
  const body = buildBody(metaId, episode, progress, info);
  if (body && (await post(action, body))) return true;
  if (!owned()) return false;
  const retry = await fallbackBody(metaId, episode, progress);
  if (!owned() || !retry) return false;
  return post(action, retry);
}
