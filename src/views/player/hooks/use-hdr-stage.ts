import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isWindowsDesktop } from "@/lib/platform";
import {
  hdrOverlayClose,
  hdrOverlayOpen,
  hdrOverlayShow,
  onHdrStageDead,
  onHdrStageReady,
} from "@/lib/hdr-overlay";
import type { Settings } from "@/lib/settings";
import { startHdrStageSession } from "@/lib/player/hdr-stage-session";

const HDR_GAMMAS = new Set(["pq", "hlg"]);
const MONITOR_DEBOUNCE_MS = 600;
const RECOVERY_POLL_MS = 4000;

export type HdrStageState = { requested: boolean; confirmed: boolean };

async function displayHdrActive(): Promise<boolean> {
  try {
    return await invoke<boolean>("display_hdr_active");
  } catch {
    return false;
  }
}

export function useHdrStage(params: {
  sourceKey: string;
  engine: "html5" | "mpv";
  embedActive: boolean;
  hdrGamma: string;
  playerHdrStage: Settings["playerHdrStage"];
  playerHdrToSdr: boolean;
  onFallback?: () => void;
}): HdrStageState {
  const { sourceKey, engine, embedActive, hdrGamma, playerHdrStage, playerHdrToSdr, onFallback } =
    params;
  const [want, setWant] = useState(false);
  const [requested, setRequested] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  useEffect(() => setFailed(false), [sourceKey, playerHdrStage, playerHdrToSdr]);

  const eligible =
    isWindowsDesktop() &&
    engine === "mpv" &&
    embedActive &&
    playerHdrStage !== "off" &&
    !playerHdrToSdr &&
    !failed &&
    HDR_GAMMAS.has(hdrGamma);

  useEffect(() => {
    if (!eligible) {
      setWant(false);
      return;
    }
    if (playerHdrStage === "always") {
      setWant(true);
      return;
    }
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let cancelled = false;
    let unMoved: (() => void) | null = null;
    let unFlip: (() => void) | null = null;
    let timer: number | null = null;
    const recheck = async () => {
      const w = await displayHdrActive();
      if (!cancelled) setWant(w);
    };
    void recheck();
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const off = await getCurrentWindow().onMoved(() => {
        if (timer != null) window.clearTimeout(timer);
        timer = window.setTimeout(() => void recheck(), MONITOR_DEBOUNCE_MS);
      });
      if (cancelled) off();
      else unMoved = off;
    })();
    // The display-info script flips the display a beat after the video
    // opens; re-check once the OS-level flip lands so staging follows it.
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const off = await listen("hdr-stage://display-status", () => {
        if (timer != null) window.clearTimeout(timer);
        timer = window.setTimeout(() => void recheck(), 250);
      });
      if (cancelled) off();
      else unFlip = off;
    })();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      unMoved?.();
      unFlip?.();
    };
  }, [eligible, playerHdrStage]);

  useEffect(() => {
    if (!want) return;
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    setRequested(true);
    const stop = startHdrStageSession({
      id: () => crypto.randomUUID(),
      open: hdrOverlayOpen,
      show: hdrOverlayShow,
      close: async (id) => {
        await hdrOverlayClose(id);
        window.dispatchEvent(new Event("harbor:mpv-force-geom"));
      },
      ready: onHdrStageReady,
      dead: onHdrStageDead,
      confirmed: (active) => {
        setConfirmed(active);
        window.dispatchEvent(new Event("harbor:mpv-force-geom"));
      },
      fallback: () => {
        onFallbackRef.current?.();
        setFailed(true);
      },
      schedule: (callback, ms) => {
        const timer = window.setTimeout(callback, ms);
        return () => window.clearTimeout(timer);
      },
    });
    return () => {
      stop();
      setRequested(false);
    };
  }, [want, sourceKey]);

  useEffect(() => {
    if (!failed) return;
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let prevHdr = true;
    const id = window.setInterval(() => {
      void displayHdrActive().then((hdr) => {
        if (hdr && !prevHdr) setFailed(false);
        prevHdr = hdr;
      });
    }, RECOVERY_POLL_MS);
    return () => window.clearInterval(id);
  }, [failed]);

  return { requested, confirmed };
}
