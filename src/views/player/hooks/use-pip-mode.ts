import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";

export function usePipMode(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  setChromeHidden: (hidden: boolean) => void;
}) {
  const { bridgeRef, setChromeHidden } = params;
  const [pipMode, setPipMode] = useState(false);
  const setChromeHiddenRef = useRef(setChromeHidden);
  setChromeHiddenRef.current = setChromeHidden;

  useEffect(() => {
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let unlistenEntered: (() => void) | null = null;
    let unlistenExited: (() => void) | null = null;
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
      if (cancelled) {
        try {
          onEntered();
        } catch {}
        try {
          onExited();
        } catch {}
        return;
      }
      unlistenEntered = onEntered;
      unlistenExited = onExited;
    })();
    return () => {
      cancelled = true;
      try {
        unlistenEntered?.();
      } catch {}
      try {
        unlistenExited?.();
      } catch {}
      unlistenEntered = null;
      unlistenExited = null;
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
        await invoke("window_pip_exit");
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
        await invoke("window_pip_enter");
      }
    } catch (e) {
      console.warn("[player] pip toggle failed, reverting", e);
      setPipMode(false);
      setChromeHidden(false);
      bridgeRef.current?.requestPiP();
    }
  }, [pipMode, setChromeHidden]);

  const exitPip = useCallback(async () => {
    if (!pipMode) return;
    setPipMode(false);
    setChromeHidden(false);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("window_pip_exit");
    } catch {}
  }, [pipMode, setChromeHidden]);

  return { pipMode, togglePipMode, exitPip };
}
