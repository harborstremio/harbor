import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { useSettings } from "@/lib/settings";
import { useEffect, useRef } from "react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function usePauseOnInactive({
  bridgeRef,
  snapRef,
}: {
  bridgeRef: React.RefObject<PlayerBridge | null>;
  snapRef: React.RefObject<PlayerSnapshot>;
}) {
  const { settings } = useSettings();
  const pauseMinimized = settings.pauseMinimized;
  const pauseUnfocused = settings.pauseUnfocused;
  const autoPausedRef = useRef(false);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen("harbor://window-activity", () => {
        window.dispatchEvent(new Event("harbor:mpv-force-geom"));
      }).then((u) => {
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    if (!pauseMinimized && !pauseUnfocused) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<{ focused: boolean; minimized: boolean }>("harbor://window-activity", (e) => {
        const bridge = bridgeRef.current;
        if (!bridge) return;
        const { focused, minimized } = e.payload;
        if (!focused) {
          const shouldPause = minimized ? pauseMinimized : pauseUnfocused;
          if (shouldPause && snapRef.current.status === "playing") {
            autoPausedRef.current = true;
            bridge.pause();
          }
        } else if (autoPausedRef.current) {
          autoPausedRef.current = false;
          if (snapRef.current.status === "paused") void bridge.play();
        }
      }).then((u) => {
        if (cancelled) u();
        else unlisten = u;
      }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [bridgeRef, snapRef, pauseMinimized, pauseUnfocused]);
}
