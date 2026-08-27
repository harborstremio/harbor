import { dlog } from "@/lib/debug";

export type PlaybackMilestone =
  | "resolve-start"
  | "resolve-ready"
  | "preflight-start"
  | "preflight-ready"
  | "player-opened"
  | "bridge-load"
  | "loadfile-accepted"
  | "file-loaded"
  | "first-frame";

type ActiveTrace = {
  startedAt: number;
  sourceClass: "direct" | "debrid" | "p2p" | "unknown";
};

const active = new Map<string, ActiveTrace>();
let nextTraceId = 0;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function markName(traceId: string, milestone: string): string {
  return `harbor:playback:${traceId}:${milestone}`;
}

export function beginPlaybackTrace(sourceClass: ActiveTrace["sourceClass"]): string {
  const traceId = `${Date.now().toString(36)}-${(++nextTraceId).toString(36)}`;
  active.set(traceId, { startedAt: now(), sourceClass });
  performance?.mark?.(markName(traceId, "committed"));
  dlog(`[perf][playback] ${traceId} committed source=${sourceClass}`);
  return traceId;
}

export function markPlaybackTrace(
  traceId: string | null | undefined,
  milestone: PlaybackMilestone,
): void {
  if (!traceId || !active.has(traceId)) return;
  performance?.mark?.(markName(traceId, milestone));
  const trace = active.get(traceId)!;
  dlog(
    `[perf][playback] ${traceId} ${milestone} elapsed_ms=${Math.round(now() - trace.startedAt)}`,
  );
}

export function finishPlaybackTrace(
  traceId: string | null | undefined,
  outcome: "ready" | "failed" | "aborted" | "replaced" = "ready",
): void {
  if (!traceId) return;
  const trace = active.get(traceId);
  if (!trace) return;
  const end = markName(traceId, outcome);
  performance?.mark?.(end);
  try {
    performance?.measure?.(markName(traceId, "total"), {
      start: markName(traceId, "committed"),
      end,
    });
  } catch {
    // Performance marks are diagnostic only and must never affect playback.
  }
  dlog(
    `[perf][playback] ${traceId} ${outcome} source=${trace.sourceClass} total_ms=${Math.round(
      now() - trace.startedAt,
    )}`,
  );
  active.delete(traceId);
}
