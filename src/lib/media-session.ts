import { invoke } from "@tauri-apps/api/core";

export type MediaControlAction = "playpause" | "play" | "pause" | "stop" | "next" | "previous";

const MEDIA_CONTROL_ACTIONS: ReadonlySet<string> = new Set([
  "playpause",
  "play",
  "pause",
  "stop",
  "next",
  "previous",
]);

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

type MediaControlState = {
  playing: boolean;
  playPause: () => void;
  next?: () => void;
  previous?: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
};

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function isMediaControlAction(value: unknown): value is MediaControlAction {
  return typeof value === "string" && MEDIA_CONTROL_ACTIONS.has(value);
}

export function createMediaControlsSession(
  desktopAvailable: () => boolean,
  invokeNative: NativeInvoke,
) {
  let lastState = "";

  return {
    update(playing: boolean, title: string, subtitle: string): boolean {
      if (!desktopAvailable()) return false;
      const state = JSON.stringify([playing, title, subtitle]);
      if (state === lastState) return false;
      lastState = state;
      void invokeNative("media_controls_update", { playing, title, subtitle }).catch(() => {});
      return true;
    },
    clear(): boolean {
      if (!desktopAvailable() || lastState === "") return false;
      lastState = "";
      void invokeNative("media_controls_clear").catch(() => {});
      return true;
    },
  };
}

export function createMediaKeyGate(cooldownMs = 350): (now?: number) => boolean {
  let lastAcceptedAt = Number.NEGATIVE_INFINITY;
  return (now = Date.now()) => {
    if (now - lastAcceptedAt < cooldownMs) return false;
    lastAcceptedAt = now;
    return true;
  };
}

export function dispatchMediaControlAction(
  action: MediaControlAction,
  state: MediaControlState,
  gate: () => boolean,
): boolean {
  let run: (() => void) | undefined;
  switch (action) {
    case "playpause":
      run = state.playPause;
      break;
    case "play":
      if (!state.playing) run = state.playPause;
      break;
    case "pause":
    case "stop":
      if (state.playing) run = state.playPause;
      break;
    case "next":
      if (state.hasNext) run = state.next;
      break;
    case "previous":
      if (state.hasPrevious) run = state.previous;
      break;
  }
  if (!run || !gate()) return false;
  run();
  return true;
}

const nativeSession = createMediaControlsSession(isTauri, (command, args) => invoke(command, args));
const acceptMediaKey = createMediaKeyGate();

export function mediaKeyGate(): boolean {
  return acceptMediaKey();
}

export function updateMediaControls(playing: boolean, title: string, subtitle: string): void {
  nativeSession.update(playing, title, subtitle);
}

export function clearMediaControls(): void {
  nativeSession.clear();
}
