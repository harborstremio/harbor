import { createHtml5Bridge } from "@/lib/player/html5";
import { createMpvBridge, probeMpv } from "@/lib/player/mpv";
import type { PlayerBridge } from "@/lib/player/bridge";

export const SYNC_DRIFT_TOLERANCE_S = 0.6;
export const SYNC_SUPPRESS_MS = 1400;
export const SYNC_PLAY_LOOKAHEAD_S = 0.4;
export const SYNC_MAX_AGE_S = 30;
export const SYNC_SEEK_JUMP_S = 10;
export const HOST_HEARTBEAT_MS = 1000;
export const HOST_MAX_WAIT_MS = 12_000;
export const GUEST_MAX_WAIT_MS = 20_000;
export const LOBBY_HOLD_MS = 1500;
export const ROOM_STALL_MS = 9000;
export const SLOW_LOAD_MS = 50_000;
export const STUCK_AUTORETRY_MS = 18_000;
export const BLACK_SCREEN_GRACE_MS = 6_000;
export const MAX_AUTORETRY_ATTEMPTS = 5;
export const CHROME_HIDE_MS_PLAYING = 1800;
export const CHROME_HIDE_MS_PAUSED = 4500;

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function formatNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export async function pickBridge(
  want: "auto" | "html5" | "mpv",
  notWebReady: boolean,
  mpvOpts: {
    anime4k: boolean;
    hdrToSdr: boolean;
    embed?: boolean;
    anime4kShaders?: string[];
    d3d11Flip?: boolean;
    preferredLangs?: string[];
    subsOff?: boolean;
    getEmbedRect?: () =>
      | Promise<{ screenX: number; screenY: number; w: number; h: number } | null>
      | { screenX: number; screenY: number; w: number; h: number }
      | null;
  },
): Promise<{ bridge: PlayerBridge; engine: "html5" | "mpv" }> {
  if (want === "html5") return { bridge: createHtml5Bridge(), engine: "html5" };
  if (want === "mpv") {
    const probe = await probeMpv();
    if (probe.available) return { bridge: createMpvBridge(mpvOpts), engine: "mpv" };
    console.warn("[harbor] mpv requested but libmpv probe failed; falling back to in-webview html5 decode (high memory)");
    return { bridge: createHtml5Bridge(), engine: "html5" };
  }
  const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (isDesktop || notWebReady) {
    const probe = await probeMpv();
    if (probe.available) return { bridge: createMpvBridge(mpvOpts), engine: "mpv" };
    if (isDesktop) console.warn("[harbor] desktop libmpv probe failed; falling back to in-webview html5 decode (high memory)");
  }
  return { bridge: createHtml5Bridge(), engine: "html5" };
}