import { resolveForMeta, resolvedToTraktTarget, type CatalogDeps } from "@/lib/tracker-resolve";
import { resolveSpecialMovie } from "@/lib/tracker-resolve/special";
import { pushWatched } from "./history";
import { scrobblePause, scrobbleStart, scrobbleStop } from "./scrobble";
import { activeProfileId } from "@/lib/active-profile-id";
import { getSession } from "./session";
import type { TraktTarget } from "./types";

const WATCHED_PCT = 70;

function captureOwner(): () => boolean {
  const profile = activeProfileId();
  const session = getSession();
  return () => {
    const current = getSession();
    return (
      session != null &&
      current != null &&
      activeProfileId() === profile &&
      (session.username ? current.username === session.username : current === session)
    );
  };
}

export type CommitOutcome = "recorded" | "already-recorded" | "not-found" | "failed";

export async function markEpisodeWatched(
  target: TraktTarget,
  metaId: string,
  deps?: CatalogDeps,
): Promise<boolean> {
  const owned = captureOwner();
  if (!owned()) return false;
  if (target.kind !== "episode") return false;
  if (await pushWatched(target)) return true;
  if (!owned()) return false;
  if (!isResolvableTarget(target)) return false;
  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!owned()) return false;
  if (!resolved.ok) {
    if (resolved.reason === "not-found" && target.season === 0) {
      const movie = await resolveSpecialMovie(metaId, target.season, target.number);
      if (movie && owned()) return pushWatched({ kind: "movie", ids: movie.ids });
    }
    return false;
  }
  return pushWatched(resolvedToTraktTarget(resolved.episode));
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
  const owned = captureOwner();
  if (!owned()) return;
  const send = action === "start" ? scrobbleStart : scrobblePause;
  if (target.kind !== "episode") {
    await send(target, progress);
    return;
  }
  if ((await send(target, progress)) === "recorded") return;
  if (!owned()) return;
  if (!isResolvableTarget(target)) return;
  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!owned() || !resolved.ok) return;
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
  const owned = captureOwner();
  if (!owned() || target.kind === "show") return "failed";

  const direct = await scrobbleStop(target, progress);
  if (!owned()) return "failed";
  if (direct === "recorded" || direct === "already-recorded") return direct;
  if (progress >= WATCHED_PCT && (await pushWatched(target))) return "recorded";
  if (!owned() || target.kind !== "episode") return "failed";
  if (!isResolvableTarget(target)) return "failed";

  const resolved = await resolveForMeta(metaId, target.season, target.number, deps);
  if (!owned()) return "failed";
  if (!resolved.ok) {
    if (resolved.reason === "not-found" && target.season === 0) {
      const movie = await resolveSpecialMovie(metaId, target.season, target.number);
      if (movie && owned()) {
        const movieTarget: TraktTarget = { kind: "movie", ids: movie.ids };
        const movieOutcome = await scrobbleStop(movieTarget, progress);
        if (!owned()) return "failed";
        if (movieOutcome === "recorded" || movieOutcome === "already-recorded") {
          return movieOutcome;
        }
        return progress >= WATCHED_PCT && (await pushWatched(movieTarget)) ? "recorded" : "failed";
      }
    }
    // Catalog searches are incomplete and can change. Keep an unconfirmed watch
    // retryable rather than permanently discarding it after a heuristic miss.
    return "failed";
  }

  const upgraded = resolvedToTraktTarget(resolved.episode);
  const outcome = await scrobbleStop(upgraded, progress);
  if (!owned()) return "failed";
  if (outcome === "recorded" || outcome === "already-recorded") return outcome;
  return progress >= WATCHED_PCT && (await pushWatched(upgraded)) ? "recorded" : "failed";
}
