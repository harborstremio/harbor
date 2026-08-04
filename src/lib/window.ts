import { openUrl as tauriOpenUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { getWindowFullscreen } from "@/lib/fullscreen-state";
import { isMacDesktop } from "@/lib/platform";

const win: Window | null = isTauri() ? getCurrentWindow() : null;

const IS_MAC = isMacDesktop();

function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const minimize = () => win?.minimize();

export const toggleMaximize = async () => {
  if (!win) return;
  if (IS_MAC) {
    const fs = await win.isFullscreen().catch(() => false);
    await win.setFullscreen(!fs).catch(() => {});
    return;
  }
  await win.toggleMaximize().catch(() => {});
};

export const close = () => win?.close();

export const setWindowFullscreen = async (fs: boolean) => {
  await win?.setFullscreen(fs).catch(() => {});
};

export const readWindowFullscreen = async (): Promise<boolean> =>
  win ? win.isFullscreen().catch(() => false) : false;

export type ResizeDir =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

export function startResize(direction: ResizeDir) {
  if (getWindowFullscreen()) return;
  win?.startResizeDragging(direction).catch(() => {});
}

export function useMaximized(): boolean {
  const [maxed, setMaxed] = useState(false);
  useEffect(() => {
    if (!win) return;
    let cancelled = false;
    let timer: number | null = null;
    const check = () => {
      (IS_MAC ? win.isFullscreen() : win.isMaximized()).then((v) => {
        if (!cancelled) setMaxed(v);
      });
    };
    check();
    const schedule = () => {
      if (timer != null) return;
      timer = window.setTimeout(() => {
        timer = null;
        check();
      }, 150);
    };
    const unlisten = win.onResized(schedule);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      unlisten.then((fn) => fn());
    };
  }, []);
  return maxed;
}

export function openUrl(url: string) {
  if (!url) return;
  if (isTauri()) {
    tauriOpenUrl(url).catch(() => {
      invoke("browser_open", { url }).catch(() => {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          /* swallow */
        }
      });
    });
    return;
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    /* swallow */
  }
}

// Hosts that aggressively block iframe embedding (X-Frame-Options DENY,
// bot/captcha challenges, etc.). For these, skip the viewport — open
// in the user's real browser instead, like a normal link.
const IFRAME_HOSTILE_HOSTS = [
  "imdb.com",
  "www.imdb.com",
  "m.imdb.com",
  "youtube.com",
  "www.youtube.com",
  "accounts.google.com",
  "github.com",
  "x.com",
  "twitter.com",
];

function isIframeHostile(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return IFRAME_HOSTILE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function openInAppBrowser(url: string, title?: string) {
  if (!url) return;
  if (isIframeHostile(url)) {
    openUrl(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("harbor:open-embed-viewport", { detail: { url, title } }));
  }
}
