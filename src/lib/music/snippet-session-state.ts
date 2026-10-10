import type { MusicPlayerState } from "./types";
import { queueTrackKey } from "./queue-order";

type SessionDependencies = {
  getMusicState: () => MusicPlayerState; subscribeMusic: (listener: () => void) => () => void; toggleMusicPlayback: () => void;
};

export function createSnippetSession({ getMusicState, subscribeMusic, toggleMusicPlayback }: SessionDependencies) {
  const before = getMusicState();
  const original = before.current ? queueTrackKey(before.current) : null;
  const shouldResume = (before.phase === "playing" || before.phase === "resolving") && original !== null;
  let closed = false, resume = true, restored = false;
  let pauseRequested = false;
  let stopWaiting = () => {};
  let cancelReady = () => {};
  const restore = () => {
    const current = getMusicState();
    if (restored || !resume || !shouldResume || !current.current || queueTrackKey(current.current) !== original || current.phase !== "paused") return;
    restored = true;
    toggleMusicPlayback();
  };
  const ready = new Promise<boolean>(resolve => {
    if (!shouldResume) { resolve(before.phase !== "resolving"); return; }
    let stop: () => void = () => {};
    const deadline = setTimeout(() => { stop(); resolve(false); }, 30_000);
    stopWaiting = () => { clearTimeout(deadline); stop(); };
    cancelReady = () => { stopWaiting(); resolve(false); };
    const check = () => {
      const current = getMusicState();
      if (!current.current || queueTrackKey(current.current) !== original) { stopWaiting(); resolve(false); return; }
      if (current.phase === "resolving") return;
      if (current.phase === "playing") {
        if (!pauseRequested) { pauseRequested = true; toggleMusicPlayback(); }
        return;
      }
      stopWaiting();
      const paused = current.phase === "paused" && !!current.current && queueTrackKey(current.current) === original;
      resolve(paused);
      if (closed && paused) restore();
    };
    stop = subscribeMusic(check);
    check();
  });
  return { ready, close(restorePlayback = true) {
    if (closed) return;
    closed = true; resume = restorePlayback;
    if (!restorePlayback || !pauseRequested) cancelReady();
    restore();
  } };
}

/** React's development remount must not issue pause → resume → pause against native playback. */
export function createSnippetSessionManager(dependencies: SessionDependencies) {
  let active: { session: ReturnType<typeof createSnippetSession>; owners: Set<symbol> } | null = null;
  return () => {
    active ??= { session: createSnippetSession(dependencies), owners: new Set() };
    const held = active, owner = Symbol();
    held.owners.add(owner);
    return { ready: held.session.ready, close(restorePlayback = true) {
      if (!held.owners.delete(owner)) return;
      if (!restorePlayback) { held.session.close(false); if (active === held) active = null; return; }
      queueMicrotask(() => {
        if (held.owners.size || active !== held) return;
        active = null; held.session.close();
      });
    } };
  };
}
