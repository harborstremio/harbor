import { traktRequest } from "./client";
import type { ScrobbleAction, ScrobbleResponse, TraktTarget } from "./types";

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

async function send(action: ScrobbleAction, target: TraktTarget, progress: number): Promise<ScrobbleResponse | null> {
  if (target.kind === "show") return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await traktRequest<ScrobbleResponse>(`/scrobble/${action}`, {
        method: "POST",
        body: scrobbleBody(target, progress),
      });
    } catch {
      if (attempt === 0 && action === "stop") {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return null;
    }
  }
  return null;
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
