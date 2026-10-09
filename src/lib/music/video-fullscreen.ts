import type { MusicVideoSurfaceState } from "./video-surfaces";

export type MusicVideoFullscreenState = {
  active: boolean;
  /** The viewport-filling element a surface may portal its host into while fullscreen. */
  stage: HTMLElement | null;
};

const listeners = new Set<() => void>();
let state: MusicVideoFullscreenState = { active: false, stage: null };

function syncNativeFullscreen(next: MusicVideoFullscreenState): void {
  if (typeof document === "undefined") return;
  if (next.active && next.stage) {
    if (document.fullscreenElement !== next.stage)
      void Promise.resolve(next.stage.requestFullscreen?.()).catch(() => {});
    return;
  }
  if (!next.active && document.fullscreenElement)
    void Promise.resolve(document.exitFullscreen?.()).catch(() => {});
}

function publish(next: MusicVideoFullscreenState): void {
  if (next.active === state.active && next.stage === state.stage) return;
  state = next;
  syncNativeFullscreen(next);
  for (const listener of listeners) listener();
}

if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && state.active) exitMusicVideoFullscreen();
  });
}

export function getMusicVideoFullscreen(): MusicVideoFullscreenState {
  return state;
}

export function musicVideoFullscreenActive(): boolean {
  return state.active;
}

export function subscribeMusicVideoFullscreen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enterMusicVideoFullscreen(): void {
  publish({ active: true, stage: state.stage });
}

export function exitMusicVideoFullscreen(): void {
  publish({ active: false, stage: null });
}

export function toggleMusicVideoFullscreen(): void {
  if (state.active) exitMusicVideoFullscreen();
  else enterMusicVideoFullscreen();
}

/** The overlay owns the element; a stage offered while windowed is refused, never stored. */
export function setMusicVideoFullscreenStage(stage: HTMLElement | null): void {
  publish({ active: state.active, stage: state.active ? stage : null });
}

/**
 * A track change keeps fullscreen: the queue advances through loading into playing and the
 * picture should not drop out of fullscreen between videos. A decoder that went away, or one
 * that cannot decode at all, has nothing left to show fullscreen.
 */
export function musicVideoFullscreenSurvives(status: MusicVideoSurfaceState["status"]): boolean {
  return status === "loading" || status === "playing";
}

/** Reset hook for tests; the app never tears the store down. */
export function resetMusicVideoFullscreen(): void {
  state = { active: false, stage: null };
  listeners.clear();
}
