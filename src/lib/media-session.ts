import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPlayerInteractionLocked } from "@/lib/player/interaction-lock";
import { isWindowsDesktop } from "@/lib/platform";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let lastState = "";
let lastActionAt = 0;
let lastPositionSec: number | null = null;
let lastPositionAt = 0;
let lastPlaying = false;
let windowFocused = typeof document === "undefined" || document.hasFocus();
let requestedSession: Parameters<typeof updateMediaControls> | null = null;
let pendingCommand: Promise<unknown> = Promise.resolve();

// A late update must not re-enable the session after blur/stop withdrew it.
function send(command: string, args?: Record<string, unknown>): void {
  pendingCommand = pendingCommand.then(() => invoke(command, args)).catch(() => {});
}

function withdrawSession(): void {
  const wasPublished = lastState !== "";
  lastState = "";
  lastPositionSec = null;
  lastPositionAt = 0;
  lastPlaying = false;
  if (wasPublished) send("media_controls_clear");
}

/** Windows keeps paused SMTC sessions eligible for another app's media keys. */
export function startMediaSessionWindowTracking(): () => void {
  if (!isTauri() || !isWindowsDesktop()) return () => {};
  let live = true;
  let revision = 0;
  let unlisten: (() => void) | undefined;
  const setFocused = (focused: boolean) => {
    windowFocused = focused;
    if (requestedSession) updateMediaControls(...requestedSession);
  };
  void listen<{ focused: boolean; minimized: boolean }>("harbor://window-activity", (event) => {
    if (!live) return;
    revision++;
    setFocused(event.payload.focused && !event.payload.minimized);
  }).then(async (stop) => {
    if (!live) {
      stop();
      return;
    }
    unlisten = stop;
    const observed = revision;
    const focused = await getCurrentWindow().isFocused();
    if (live && revision === observed) setFocused(focused);
  }).catch(() => {});
  return () => {
    live = false;
    unlisten?.();
  };
}

export function mediaKeyGate(): boolean {
  if (isPlayerInteractionLocked()) return false;
  if (isTauri() && isWindowsDesktop() && !windowFocused && !requestedSession?.[0]) return false;
  const now = Date.now();
  if (now - lastActionAt < 350) return false;
  lastActionAt = now;
  return true;
}

export function updateMediaControls(
  playing: boolean,
  title: string,
  subtitle: string,
  artUrl?: string | null,
  durationSec?: number | null,
  positionSec?: number | null,
  volume?: number | null,
): void {
  if (!isTauri()) return;
  requestedSession = [playing, title, subtitle, artUrl, durationSec, positionSec, volume];
  if (isWindowsDesktop() && !windowFocused && !playing) {
    withdrawSession();
    return;
  }
  const art = artUrl ?? null;
  const dur =
    typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0
      ? Math.round(durationSec)
      : null;
  const vol =
    typeof volume === "number" && Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : null;
  const volKey = vol != null ? Math.round(vol * 100) : "";
  const pos =
    typeof positionSec === "number" && Number.isFinite(positionSec) && positionSec >= 0
      ? positionSec
      : null;

  const now = Date.now();
  const state = `${playing ? 1 : 0}|${title}|${subtitle}|${art ?? ""}|${dur ?? 0}|${volKey}`;
  const metadataChanged = state !== lastState;

  let positionDrift = false;
  if (pos != null) {
    if (lastPositionSec == null || playing !== lastPlaying) {
      positionDrift = true;
    } else if (playing) {
      const elapsed = (now - lastPositionAt) / 1000;
      const expected = lastPositionSec + elapsed;
      if (Math.abs(pos - expected) > 1.2) {
        positionDrift = true;
      }
    } else {
      if (Math.abs(pos - lastPositionSec) > 0.5) {
        positionDrift = true;
      }
    }
  }

  if (!metadataChanged && !positionDrift) return;

  lastState = state;
  lastPlaying = playing;
  if (pos != null) {
    lastPositionSec = pos;
    lastPositionAt = now;
  }

  send("media_controls_update", {
    playing,
    title,
    subtitle,
    artUrl: art,
    durationSec: dur,
    positionSec: pos,
    volume: vol,
  });
}

export function notifyMediaSeeked(positionSec: number): void {
  if (!isTauri() || !Number.isFinite(positionSec)) return;
  lastPositionSec = Math.max(0, positionSec);
  lastPositionAt = Date.now();
  if (requestedSession) requestedSession[5] = lastPositionSec;
  if (lastState) send("media_controls_seeked", { positionSec });
}

export function clearMediaControls(): void {
  if (!isTauri()) return;
  requestedSession = null;
  withdrawSession();
}
