import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";

export function usePipMode(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  setChromeHidden: (hidden: boolean) => void;
  /** Detached PiP hands the window back to the app, so the player stops owning it. */
  onDetach?: () => void;
  /** Leaving detached PiP makes the player the page again. */
  onReattach?: () => void;
}) {
  const { bridgeRef, setChromeHidden, onDetach, onReattach } = params;
  const { settings } = useSettings();
  const onDetachRef = useRef(onDetach);
  onDetachRef.current = onDetach;
  const onReattachRef = useRef(onReattach);
  onReattachRef.current = onReattach;
  // Detached moves the live surface into its own window; resize shrinks Harbor itself.
  const detached = settings.pipBehavior === "native";
  const [pipMode, setPipMode] = useState(false);
  const nativeDetached = useRef(false);
  const setChromeHiddenRef = useRef(setChromeHidden);
  setChromeHiddenRef.current = setChromeHidden;

  useEffect(() => {
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let unlistenEntered: (() => void) | null = null;
    let unlistenExited: (() => void) | null = null;
    let unlistenDetached: Array<() => void> = [];
    let cancelled = false;
    const kickLayout = () => {
      const fire = () => {
        try {
          window.dispatchEvent(new Event("resize"));
          window.dispatchEvent(new Event("harbor:mpv-refresh-geom"));
          void import("@tauri-apps/api/core").then(({ invoke }) =>
            invoke("hdr_overlay_sync").catch(() => {}),
          );
        } catch {}
      };
      requestAnimationFrame(fire);
      window.setTimeout(fire, 60);
      window.setTimeout(fire, 200);
      window.setTimeout(fire, 500);
      window.setTimeout(fire, 900);
    };
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const onEntered = makeSafeTauriUnlisten(
        await listen("pip://entered", () => {
          setPipMode(true);
          setChromeHiddenRef.current(true);
          kickLayout();
        }),
      );
      const onExited = makeSafeTauriUnlisten(
        await listen("pip://exited", () => {
          setPipMode(false);
          setChromeHiddenRef.current(false);
          kickLayout();
        }),
      );
      // Detached keeps the Harbor window full size, so its chrome stays put and the
      // player closes back to whatever the viewer was on.
      const onDetachedEntered = makeSafeTauriUnlisten(
        await listen("pip://detached-entered", () => {
          nativeDetached.current = true;
          setPipMode(true);
          onDetachRef.current?.();
        }),
      );
      const onDetachedExited = makeSafeTauriUnlisten(
        await listen("pip://detached-exited", () => {
          nativeDetached.current = false;
          setPipMode(false);
          onReattachRef.current?.();
          kickLayout();
        }),
      );
      if (cancelled) {
        for (const off of [onEntered, onExited, onDetachedEntered, onDetachedExited]) {
          try {
            off();
          } catch {}
        }
        return;
      }
      unlistenEntered = onEntered;
      unlistenExited = onExited;
      unlistenDetached = [onDetachedEntered, onDetachedExited];
    })();
    return () => {
      cancelled = true;
      try {
        unlistenEntered?.();
      } catch {}
      try {
        unlistenExited?.();
      } catch {}
      for (const off of unlistenDetached) {
        try {
          off();
        } catch {}
      }
      unlistenDetached = [];
      unlistenEntered = null;
      unlistenExited = null;
      if (nativeDetached.current) {
        nativeDetached.current = false;
        void import("@tauri-apps/api/core").then(({ invoke }) => invoke("pip_window_exit")).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePipMode = useCallback(async () => {
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      bridgeRef.current?.requestPiP();
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      if (pipMode) {
        setPipMode(false);
        setChromeHidden(false);
        await invoke(nativeDetached.current ? "pip_window_exit" : "window_pip_exit");
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
        await invoke(detached ? "pip_window_enter" : "window_pip_enter");
      }
    } catch (e) {
      console.warn("[player] pip toggle failed, reverting", e);
      setPipMode(false);
      setChromeHidden(false);
      bridgeRef.current?.requestPiP();
    }
  }, [pipMode, setChromeHidden, detached]);

  const exitPip = useCallback(async () => {
    if (!pipMode) return;
    setPipMode(false);
    setChromeHidden(false);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(nativeDetached.current ? "pip_window_exit" : "window_pip_exit");
    } catch {}
  }, [pipMode, setChromeHidden, detached]);

  return { pipMode, togglePipMode, exitPip };
}
