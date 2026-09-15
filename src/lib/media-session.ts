import type { PlayerStatus } from "@/lib/player/bridge";
import { invoke } from "@tauri-apps/api/core";
import { isPlayerInteractionLocked } from "@/lib/player/interaction-lock";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let lastState = "";
let lastActionAt = 0;
let lastPositionSec: number | null = null;
let lastPositionAt = 0;
let lastPlaying = false;

let windowFocused = true;
let withdrawn = false;
let lastAdvertisedArgs: MediaControlsArgs | null = null;

interface MediaControlsArgs {
  playing: boolean;
  title: string;
  subtitle: string;
  artUrl: string | null;
  durationSec: number | null;
  positionSec: number | null;
  volume: number | null;
}

export function isMediaSessionActive(status: PlayerStatus): boolean {
  return (
    status === "playing" ||
    status === "paused" ||
    status === "ready" ||
    status === "loading"
  );
}

export function setMediaSessionWindowFocused(focused: boolean): void {
  if (!isTauri()) return;
  windowFocused = focused;

  if (!focused) {
    // (i) Withdraw non-playing sessions: clear backend but cache args so
    //     media keys fall through to e.g. Spotify while paused+blurred.
    //     Playing sessions keep their backend claim (background playback).
    if (lastAdvertisedArgs && !lastAdvertisedArgs.playing) {
      withdrawn = true;
      invoke("media_controls_clear").catch(() => {});
    }
    return;
  }

  // (iii) On refocus: re-push if withdrawn-with-cache or last-advertised was
  //       playing (recency reclaim — fresh backend announce).
  if (lastAdvertisedArgs && (withdrawn || lastAdvertisedArgs.playing)) {
    withdrawn = false;
    const a = lastAdvertisedArgs;
    invoke("media_controls_update", {
      playing: a.playing,
      title: a.title,
      subtitle: a.subtitle,
      artUrl: a.artUrl,
      durationSec: a.durationSec,
      positionSec: a.positionSec,
      volume: a.volume,
    }).catch(() => {});
  }
}

export function mediaKeyGate(): boolean {
  if (isPlayerInteractionLocked()) return false;
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
  opts?: { force?: boolean },
): void {
  if (!isTauri()) return;
  const art = artUrl ?? null;
  const dur =
    typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0
      ? Math.round(durationSec)
      : null;
  const vol =
    typeof volume === "number" && Number.isFinite(volume)
      ? Math.max(0, Math.min(1, volume))
      : null;
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

  // (ii) Paused while blurred → withdraw instead of pushing.
  //      Covers pause arriving via OS media key while window is unfocused.
  if (!windowFocused && !playing) {
    if (lastAdvertisedArgs) {
      withdrawn = true;
      // Refresh the cache with current truth so a later refocus re-pushes
      // the paused state, not the stale pre-pause snapshot.
      lastAdvertisedArgs = {
        playing,
        title,
        subtitle,
        artUrl: art,
        durationSec: dur,
        positionSec: pos,
        volume: vol,
      };
      invoke("media_controls_clear").catch(() => {});
    }
    lastState = state;
    lastPlaying = playing;
    if (pos != null) {
      lastPositionSec = pos;
      lastPositionAt = now;
    }
    return;
  }

  if (!metadataChanged && !positionDrift && !opts?.force) return;

  lastState = state;
  lastPlaying = playing;
  if (pos != null) {
    lastPositionSec = pos;
    lastPositionAt = now;
  }

  // Cache advertised args for re-assert on refocus.
  lastAdvertisedArgs = {
    playing,
    title,
    subtitle,
    artUrl: art,
    durationSec: dur,
    positionSec: pos,
    volume: vol,
  };
  withdrawn = false;

  invoke("media_controls_update", {
    playing,
    title,
    subtitle,
    artUrl: art,
    durationSec: dur,
    positionSec: pos,
    volume: vol,
  }).catch(() => {});
}

export function notifyMediaSeeked(positionSec: number): void {
  if (!isTauri() || !Number.isFinite(positionSec)) return;
  lastPositionSec = Math.max(0, positionSec);
  lastPositionAt = Date.now();
  invoke("media_controls_seeked", { positionSec }).catch(() => {});
}

export function clearMediaControls(): void {
  if (!isTauri()) return;
  lastState = "";
  lastPositionSec = null;
  lastPositionAt = 0;
  lastPlaying = false;
  // (iv) Ended/unmount: drop cached args and clear withdrawn flag so the
  //      session is never re-asserted after an explicit clear.
  lastAdvertisedArgs = null;
  withdrawn = false;
  invoke("media_controls_clear").catch(() => {});
}
