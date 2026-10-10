import type { RoomSnapshot } from "@/lib/together/client";
import type { SyncState } from "@/lib/together/protocol";
import { listenStateMatchesTrack, listenTrackFromState, type ListenTrackRef } from "./track-state";

export type ListenRole = "host" | "guest";

/**
 * What a guest should do with a state the host just published. Kept as a decision rather
 * than an action so it can be tested without a player, and so the caller owns every
 * side effect on the local music engine.
 */
export type ListenAction =
  | { kind: "none" }
  | { kind: "load"; track: ListenTrackRef; positionSeconds: number; playing: boolean }
  | { kind: "seek"; positionSeconds: number }
  | { kind: "play" }
  | { kind: "pause" };

export type ListenLocal = {
  track: { id: string; connectorId?: string | null } | null;
  positionSeconds: number;
  playing: boolean;
};

/** Past this, a guest is not drifting, they are somewhere else entirely. */
export const LISTEN_DRIFT_SECONDS = 2.5;

export function listenRoleOf(
  snapshot: Pick<RoomSnapshot, "hostClientId">,
  clientId: string,
): ListenRole {
  return snapshot.hostClientId === clientId ? "host" : "guest";
}

export function listenActionFor(state: SyncState | null, local: ListenLocal): ListenAction {
  const wanted = listenTrackFromState(state);
  if (!state || !wanted) return { kind: "none" };

  if (!listenStateMatchesTrack(state, local.track)) {
    return {
      kind: "load",
      track: wanted,
      positionSeconds: state.positionSeconds,
      playing: state.playing,
    };
  }
  if (Math.abs(local.positionSeconds - state.positionSeconds) > LISTEN_DRIFT_SECONDS) {
    return { kind: "seek", positionSeconds: state.positionSeconds };
  }
  if (state.playing && !local.playing) return { kind: "play" };
  if (!state.playing && local.playing) return { kind: "pause" };
  return { kind: "none" };
}

/**
 * A host only republishes when something a listener would notice has changed. Position
 * alone is not a change: it advances on its own at both ends, and republishing it every
 * tick would put a write on the relay ten times a second for no benefit.
 */
export function listenShouldPublish(previous: SyncState | null, next: SyncState): boolean {
  if (!previous) return true;
  if (previous.mediaId !== next.mediaId) return true;
  if (previous.mediaTitle !== next.mediaTitle) return true;
  if (previous.playing !== next.playing) return true;
  if ((previous.speed ?? 1) !== (next.speed ?? 1)) return true;
  return Math.abs(previous.positionSeconds - next.positionSeconds) > LISTEN_DRIFT_SECONDS;
}

export function listenListenerCount(snapshot: Pick<RoomSnapshot, "participants">): number {
  return snapshot.participants?.length ?? 0;
}
