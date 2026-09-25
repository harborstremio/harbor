import { resolveForMeta } from "@/lib/tracker-resolve";
import { simklRequest } from "./client";
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

async function post(
  action: ScrobbleAction,
  body: Record<string, unknown>,
): Promise<boolean> {
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
  info?: ScrobbleInfo,
): Promise<Record<string, unknown> | null> {
  if (ANIME_ID.test(metaId)) return null;
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
    info,
  );
}

export async function simklScrobble(
  action: ScrobbleAction,
  metaId: string,
  episode: EpisodeRef,
  progress: number,
  info?: ScrobbleInfo,
): Promise<boolean> {
  const body = buildBody(metaId, episode, progress, info);
  if (body && (await post(action, body))) return true;
  const retry = await fallbackBody(metaId, episode, progress, info);
  if (!retry) return false;
  return post(action, retry);
}
