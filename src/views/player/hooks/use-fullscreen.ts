import {
  consumeMarathonReenter,
  enterWindowFullscreen,
  exitWindowFullscreenOnPlayerClose,
  getWindowFullscreen,
  setWindowFullscreen,
  subscribeFullscreen,
  toggleWindowFullscreen,
} from "@/lib/fullscreen-state";
import { useCallback, useEffect, useState } from "react";

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
    const mpvKick = async () => {
      if (cancelled) return;
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("harbor:mpv-refresh-geom"));
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("webview_reapply_transparency").catch(() => {});
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
    const delays = [60, 160, 320, 640, 1100, 1700, 2400, 3200, 4200];
    const timers = delays.map((d) => window.setTimeout(() => void mpvKick(), d));
    const sustain = window.setInterval(() => void mpvKick(), 2000);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(sustain);
    };
  }, [fullscreen]);

  const toggleFullscreen = useCallback(() => {
    void toggleWindowFullscreen();
  }, []);

  return { fullscreen, toggleFullscreen };
}
