import type { MusicTrack } from "./types";

export type MusicVideoSurfaceState = {
  owner: symbol | null;
  key: string;
  status: "idle" | "loading" | "playing" | "unavailable";
};
type Surface = { track: MusicTrack; priority: number };
type OpenVideo = (track: MusicTrack, signal: AbortSignal, failed: () => void) => Promise<void>;
/** Runs while no surface is mounted. Calling release ends the decoder; the result cancels. */
export type HoldVideo = (release: () => void) => () => void;

export type MusicVideoMount = { key: string; priority: number };
export type MusicVideoSession = { key: string; live: boolean; failedKey: string };
export type MusicVideoHandoff =
  | { action: "stop" }
  | { action: "park" }
  | { action: "adopt"; owner: symbol; key: string }
  | { action: "load"; owner: symbol; key: string };

/**
 * The whole persistence decision in one place: the highest-priority mounted surface takes the
 * picture, an equal key keeps the session it already has, and an empty screen parks rather than
 * stops for as long as the session is alive.
 */
export function musicVideoHandoff(
  mounted: Iterable<[symbol, MusicVideoMount]>,
  session: MusicVideoSession,
): MusicVideoHandoff {
  let winner: [symbol, MusicVideoMount] | null = null;
  for (const entry of mounted)
    if (!winner || entry[1].priority > winner[1].priority) winner = entry;
  if (!winner) return session.live ? { action: "park" } : { action: "stop" };
  const key = winner[1].key;
  if (key === session.key && (session.live || session.failedKey === key))
    return { action: "adopt", owner: winner[0], key };
  return { action: "load", owner: winner[0], key };
}

export function musicVideoSessionKey(track: Pick<MusicTrack, "id" | "connectorId">): string {
  return `${track.connectorId ?? ""}:${track.id}`;
}

const releaseImmediately: HoldVideo = (release) => {
  release();
  return () => {};
};

/** Surfaces share one decoder. React handoffs only move its rectangle, never reload it. */
export function createMusicVideoSurfaces(open: OpenVideo, hold: HoldVideo = releaseImmediately) {
  const surfaces = new Map<symbol, Surface>();
  const listeners = new Set<() => void>();
  let state: MusicVideoSurfaceState = { owner: null, key: "", status: "idle" };
  let run: AbortController | null = null;
  let failedKey = "";
  let pending = false;
  let holding = false;
  let cancelHold: (() => void) | null = null;
  const publish = (patch: Partial<MusicVideoSurfaceState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  // An aborted run has already released the picture, so it is not a session anyone can be
  // handed. Only liveness, never the mere presence of a run, may keep the current key.
  const live = () => run !== null && !run.signal.aborted;
  const stop = () => {
    run?.abort();
    run = null;
    failedKey = "";
    if (state.owner !== null || state.key !== "" || state.status !== "idle")
      publish({ owner: null, key: "", status: "idle" });
  };
  const endHold = () => {
    if (!holding) return;
    holding = false;
    const cancel = cancelHold;
    cancelHold = null;
    cancel?.();
  };
  // Collapsing Now Playing leaves no surface mounted. Tearing the decoder down there is what
  // makes reopening a cold rebuild, so the hold decides when the gap has become a real stop.
  const startHold = () => {
    if (holding) return;
    holding = true;
    const cancel = hold(() => {
      if (!holding) return;
      holding = false;
      const done = cancelHold;
      cancelHold = null;
      done?.();
      if (surfaces.size) {
        schedule();
        return;
      }
      stop();
    });
    if (holding) cancelHold = cancel;
    else cancel();
  };
  const reconcile = () => {
    pending = false;
    const mounted: Array<[symbol, MusicVideoMount]> = [];
    for (const [owner, surface] of surfaces)
      mounted.push([
        owner,
        { key: musicVideoSessionKey(surface.track), priority: surface.priority },
      ]);
    const next = musicVideoHandoff(mounted, { key: state.key, live: live(), failedKey });
    if (next.action === "stop") {
      endHold();
      stop();
      return;
    }
    if (next.action === "park") {
      startHold();
      if (holding && state.owner !== null) publish({ owner: null });
      return;
    }
    endHold();
    const key = next.key;
    if (next.action === "adopt") {
      if (state.owner !== next.owner) publish({ owner: next.owner });
      return;
    }
    const chosen = surfaces.get(next.owner);
    if (!chosen) return;
    run?.abort();
    run = null;
    failedKey = "";
    const controller = new AbortController();
    run = controller;
    publish({ owner: next.owner, key, status: "loading" });
    const failed = () => {
      if (run !== controller || controller.signal.aborted) return;
      failedKey = key;
      publish({ status: "unavailable" });
      controller.abort();
    };
    void open(chosen.track, controller.signal, failed)
      .then(() => {
        if (run === controller && !controller.signal.aborted) publish({ status: "playing" });
      })
      .catch(failed);
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(reconcile);
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(owner: symbol, track: MusicTrack, priority = 0) {
      surfaces.set(owner, { track, priority });
      schedule();
      return () => {
        surfaces.delete(owner);
        schedule();
      };
    },
    retry() {
      failedKey = "";
      endHold();
      run?.abort();
      run = null;
      schedule();
    },
  };
}
