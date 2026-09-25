import { resolveForMeta } from "@/lib/tracker-resolve";
import { resolveSimklEpisodeTarget, stremioIdToSimklTarget } from "./ids";
import { addToHistory, markEpisodesWatched } from "./history";
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
  const r = stremioIdToSimklTarget(metaId, episode);
  const t = r.ok
    ? r.target
    : episode
      ? await resolveSimklEpisodeTarget(metaId, episode, info?.imdb)
      : null;
  if (!t) return false;
  if (t.kind === "episode") {
    if (await markEpisodesWatched(t.show.ids, t.season, [t.number])) return true;
    if (ANIME_ID.test(metaId)) return false;
    const resolved = await resolveForMeta(metaId, t.season, t.number);
    if (!resolved.ok) return false;
    return markEpisodesWatched(
      resolved.episode.showIds,
      resolved.episode.season,
      [resolved.episode.number],
    );
  }
  if (t.kind === "anime-episode") return markEpisodesWatched(t.anime.ids, t.season, [t.number]);
  return addToHistory(t, metaId);
}
