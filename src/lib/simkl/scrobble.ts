import { activeProfileId } from "@/lib/active-profile-id";
import { getSession } from "./session";
import { resolveForMeta } from "@/lib/tracker-resolve";
import { resolveTrackerAnimeEntry } from "@/lib/anime-tracker-entry";
import { anilistToMal } from "@/lib/providers/anime-mapping";
import { getAnimeCwId } from "@/lib/anime-cw-ids";
import { isDetectedAnime } from "@/lib/anime-detect";
import { simklRequest, SimklApiError } from "./client";
import {
  buildAnimeBody,
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
  } catch (e) {
    // Background-safe: live scrobble failures must never break playback.
    // A stop that was already finalized means the watch is recorded — Simkl
    // reports that as 409 with watched_at, and it must not be retried.
    if (action === "stop" && e instanceof SimklApiError && e.status === 409) return true;
    return false;
  }
}

/**
 * Simkl numbers anime by AniDB and keys them off the owning entry, so a scrobble
 * built from a catalog row's umbrella ids can land on no entry at all. Only
 * attempt the anime-entry path for a row that is already known to be anime, so
 * ordinary TV scrobbles never pay for the lookup.
 */
function catalogAnimeRow(metaId: string): boolean {
  const catalog = metaId.startsWith("tt") || metaId.startsWith("tmdb:");
  if (!catalog) return false;
  return getAnimeCwId(metaId) != null || isDetectedAnime(metaId);
}

/**
 * The entry a built anime body is scrobbled against, in `scheme:id` form, so a
 * later-cour refinement can tell the row's parent entry from a stream-scoped one.
 */
function animeBodyEntryId(body: Record<string, unknown>): string | null {
  const ids = (body.anime as { ids?: Record<string, unknown> } | undefined)?.ids;
  if (!ids) return null;
  for (const scheme of ["kitsu", "mal", "anidb"] as const) {
    const id = ids[scheme];
    if (typeof id === "number" && Number.isFinite(id)) return `${scheme}:${id}`;
  }
  return null;
}

/**
 * Convert a resolved tracker entry id to a Simkl anime node. Simkl accepts
 * kitsu/mal/anidb directly; an AniList-only entry is mapped through its MAL id.
 */
async function animeBodyForEntry(
  entryId: string,
  episode: number,
  progress: number,
): Promise<Record<string, unknown> | null> {
  const [scheme, raw] = entryId.split(":");
  const id = Number(raw);
  if (!Number.isFinite(id)) return null;
  if (scheme === "kitsu" || scheme === "mal" || scheme === "anidb") {
    return buildAnimeBody({ [scheme]: id }, episode, progress);
  }
  if (scheme === "anilist") {
    const mal = await anilistToMal(id).catch(() => null);
    return mal != null ? buildAnimeBody({ mal }, episode, progress) : null;
  }
  return null;
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
  );
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
  const body = buildBody(metaId, episode, progress, info);
  const isAnimeNode = body != null && "anime" in body;
  // A named anime entry stays the priority the existing path established.
  if (isAnimeNode) {
    const currentId = animeBodyEntryId(body);
    if (currentId) {
      const entry = await resolveTrackerAnimeEntry(metaId, {
        season: episode?.season,
        episode: episode?.episode,
        imdbSeason: episode?.imdbSeason,
        imdbEpisode: episode?.imdbEpisode,
      });
      if (!owned()) return false;
      // The row's parent cour kept provider season 2 under its season-1 entry;
      // send the sequel that actually aired the episode instead.
      if (entry && entry.id !== currentId && entry.baseId === currentId) {
        const animeBody = await animeBodyForEntry(entry.id, entry.episode, progress);
        if (animeBody && (await post(action, animeBody))) return true;
      }
    }
    if (await post(action, body)) return true;
  } else if (body && catalogAnimeRow(metaId)) {
    // An anime row whose episode could not name its entry must not be scrobbled
    // against the umbrella catalog entry. Resolve the cour that aired it first.
    const entry = await resolveTrackerAnimeEntry(metaId, {
      season: episode?.season,
      episode: episode?.episode,
      imdbSeason: episode?.imdbSeason,
      imdbEpisode: episode?.imdbEpisode,
    });
    if (!owned()) return false;
    if (entry) {
      const animeBody = await animeBodyForEntry(entry.id, entry.episode, progress);
      if (animeBody && (await post(action, animeBody))) return true;
    }
    if (await post(action, body)) return true;
  } else if (body) {
    if (await post(action, body)) return true;
  }
  if (!owned()) return false;
  const retry = await fallbackBody(metaId, episode, progress);
  if (!owned() || !retry) return false;
  return post(action, retry);
}
