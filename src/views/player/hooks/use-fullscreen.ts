import { useCallback, useEffect, useState } from "react";
import {
  consumeMarathonReenter,
  enterWindowFullscreen,
  exitWindowFullscreenOnPlayerClose,
  getWindowFullscreen,
  setWindowFullscreen,
  subscribeFullscreen,
  toggleWindowFullscreen,
} from "@/lib/fullscreen-state";

export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(getWindowFullscreen);

  useEffect(() => subscribeFullscreen(() => setFullscreen(getWindowFullscreen())), []);

  useEffect(
    () => () => {
      void exitWindowFullscreenOnPlayerClose();
    },
    [],
  );

  useEffect(() => {
    if (consumeMarathonReenter() && !getWindowFullscreen()) {
      void enterWindowFullscreen();
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setWindowFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    let cancelled = false;
    let kickDebounce: number | null = null;
    const mpvKick = async () => {
      if (cancelled) return;
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("harbor:mpv-refresh-geom"));
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        // Windows keeps WebView2 opaque outside embedded mpv. Reapplying
        // transparency for HTML5 or non-embedded mpv fullscreen would undo
        // that recovery policy and can reintroduce a black WebView surface.
        if (document.documentElement.dataset.mpvEmbed === "1") {
          await invoke("webview_reapply_transparency").catch(() => {});
        }
        await invoke("mpv_force_below").catch(() => {});
        await invoke("hdr_overlay_sync").catch(() => {});
      } catch {
        /* not tauri */
      }
    };
    const reassertOs = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("window_fullscreen_enter").catch(() => {});
      } catch {
        /* not tauri */
      }
    };
    void reassertOs();
    void mpvKick();
    const onResize = () => {
      if (kickDebounce != null) window.clearTimeout(kickDebounce);
      kickDebounce = window.setTimeout(() => void mpvKick(), 80);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      if (kickDebounce != null) window.clearTimeout(kickDebounce);
      window.removeEventListener("resize", onResize);
    };
  }, [fullscreen]);

  const toggleFullscreen = useCallback(() => {
    void toggleWindowFullscreen();
  }, []);

  return { fullscreen, toggleFullscreen };
}
