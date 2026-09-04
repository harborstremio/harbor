import { invoke } from "@tauri-apps/api/core";
import { isPlayerInteractionLocked } from "@/lib/player/interaction-lock";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let lastState = "";
let lastActionAt = 0;

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
): void {
  if (!isTauri()) return;
  const art = artUrl ?? null;
  const dur = typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : null;
  const state = `${playing ? 1 : 0}|${title}|${subtitle}|${art ?? ""}|${dur ?? 0}`;
  if (state === lastState) return;
  lastState = state;
  invoke("media_controls_update", {
    playing,
    title,
    subtitle,
    artUrl: art,
    durationSec: durationSec != null && Number.isFinite(durationSec) ? durationSec : null,
    positionSec: positionSec != null && Number.isFinite(positionSec) ? positionSec : null,
  }).catch(() => {});
}

export function clearMediaControls(): void {
  if (!isTauri()) return;
  lastState = "";
  invoke("media_controls_clear").catch(() => {});
}
