import { traktRequest, TraktApiError } from "./client";
import type { ScrobbleAction, TraktTarget } from "./types";

export type ScrobbleOutcome = "recorded" | "already-recorded" | "failed";

function scrobbleBody(target: TraktTarget, progress: number) {
  const clamped = Math.max(0, Math.min(100, Number(progress.toFixed(2))));
  if (target.kind === "movie") {
    return { movie: { ids: target.ids }, progress: clamped };
  }
  if (target.kind === "episode") {
    return {
      show: { ids: target.show.ids },
      episode: { season: target.season, number: target.number },
      progress: clamped,
    };
  }
  return { show: { ids: target.ids }, progress: clamped };
}

async function send(
  action: ScrobbleAction,
  target: TraktTarget,
  progress: number,
): Promise<ScrobbleOutcome> {
  if (target.kind === "show") return "failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await traktRequest(`/scrobble/${action}`, {
        method: "POST",
        body: scrobbleBody(target, progress),
      });
      return "recorded";
    } catch (error) {
      if (action === "stop" && error instanceof TraktApiError && error.status === 409) {
        return "already-recorded";
      }
      if (attempt === 0 && action === "stop") {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return "failed";
    }
  }
  return "failed";
}

export function scrobbleStart(target: TraktTarget, progress: number) {
  return send("start", target, progress);
}

export function scrobblePause(target: TraktTarget, progress: number) {
  return send("pause", target, progress);
}

export function scrobbleStop(target: TraktTarget, progress: number) {
  return send("stop", target, progress);
}
