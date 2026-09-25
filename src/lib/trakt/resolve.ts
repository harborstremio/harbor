import { meta as fetchMeta, type Meta } from "@/lib/cinemeta";
import { resolveForMeta, resolvedToTraktTarget, type CatalogDeps } from "@/lib/tracker-resolve";
import { resolveSpecialMovie } from "@/lib/tracker-resolve/special";
import { pushWatched } from "./history";
import { stremioIdToTraktTarget } from "./ids";
import { scrobblePause, scrobbleStart, scrobbleStop } from "./scrobble";
import type { TraktTarget } from "./types";

const DAY_MS = 86_400_000;

export type CommitOutcome = "recorded" | "already-recorded" | "not-found" | "failed";

export async function markEpisodeWatched(
  target: TraktTarget,
  metaId: string,
  deps?: CatalogDeps,
): Promise<boolean> {
  if (target.kind !== "episode") return false;
  if (await pushWatched(target)) return true;
  if (!isResolvableTarget(target)) return false;
  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!resolved.ok) {
    if (resolved.reason === "not-found" && target.season === 0) {
      const movie = await resolveSpecialMovie(metaId, target.season, target.number);
      if (movie) return pushWatched({ kind: "movie", ids: movie.ids });
    }
    return false;
  }
  return pushWatched(resolvedToTraktTarget(resolved.episode));
}

function airedEpisodes(videos: Meta["videos"]): Array<{ season: number; episode: number }> {
  const now = Date.now() + DAY_MS;
  const out: Array<{ season: number; episode: number }> = [];
  for (const video of videos ?? []) {
    const season = video.season ?? 0;
    const episode = video.episode ?? video.number;
    if (season < 1 || episode == null) continue;
    const airDate = video.released ?? video.firstAired;
    if (airDate && Date.parse(airDate) > now) continue;
    out.push({ season, episode });
  }
  return out;
}

// Trakt has no show-level mark call, so a show is expanded into its aired episodes;
// per-episode writes are what let each season resolve onto its own entry.
export async function markSeriesWatched(metaId: string): Promise<boolean> {
  const series = await fetchMeta("series", metaId.split(":")[0], true).catch(() => null);
  if (!series) return false;
  const episodes = airedEpisodes(series.videos);
  let any = false;
  for (const episode of episodes) {
    const resolved = stremioIdToTraktTarget(metaId, episode);
    if (!resolved.ok) continue;
    if (await markEpisodeWatched(resolved.target, metaId)) any = true;
  }
  return any;
}

// Progress scrobbles carry the same raw numbering as the terminal write, so they need
// the same resolution or Trakt never shows "now playing" for a renumbered season.
export async function commitPlaybackState(
  action: "start" | "pause",
  target: TraktTarget,
  metaId: string,
  progress: number,
  deps?: CatalogDeps,
): Promise<void> {
  const send = action === "start" ? scrobbleStart : scrobblePause;
  if (target.kind !== "episode") {
    await send(target, progress);
    return;
  }
  if ((await send(target, progress)) === "recorded") return;
  if (!isResolvableTarget(target)) return;
  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!resolved.ok) return;
  await send(resolvedToTraktTarget(resolved.episode), progress);
}

export function isResolvableTarget(target: TraktTarget): boolean {
  if (target.kind !== "episode") return false;
  return !(target.episodeIds && Object.keys(target.episodeIds).length > 0);
}

/**
 * Writes an episode as watched on Trakt, falling back to catalog resolution when the
 * verbatim Stremio numbering is one Trakt does not have (a merged season, or a split
 * entry Trakt keeps under its parent show).
 *
 * "not-found" is deliberately distinct from "failed": the episode does not exist on
 * Trakt at all, so replaying it forever would only burn quota. Callers must drop it.
 */
export async function commitWatchedEpisode(
  target: TraktTarget,
  metaId: string,
  progress: number,
  deps?: CatalogDeps,
): Promise<CommitOutcome> {
  if (target.kind !== "episode") return "failed";

  const direct = await scrobbleStop(target, progress);
  if (direct === "recorded" || direct === "already-recorded") return direct;
  if (await pushWatched(target)) return "recorded";
  if (!isResolvableTarget(target)) return "failed";

  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!resolved.ok) {
    if (resolved.reason === "not-found" && target.season === 0) {
      const movie = await resolveSpecialMovie(metaId, target.season, target.number);
      if (movie) {
        const movieTarget: TraktTarget = { kind: "movie", ids: movie.ids };
        const movieOutcome = await scrobbleStop(movieTarget, progress);
        if (movieOutcome === "recorded" || movieOutcome === "already-recorded") {
          return movieOutcome;
        }
        return (await pushWatched(movieTarget)) ? "recorded" : "failed";
      }
    }
    return resolved.reason === "not-found" ? "not-found" : "failed";
  }

  const upgraded = resolvedToTraktTarget(resolved.episode);
  const outcome = await scrobbleStop(upgraded, progress);
  if (outcome === "recorded" || outcome === "already-recorded") return outcome;
  return (await pushWatched(upgraded)) ? "recorded" : "failed";
}
