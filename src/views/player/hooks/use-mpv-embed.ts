import { useEffect } from "react";
import { modalOverlayClose, modalOverlaySync } from "@/lib/modal-overlay";
import { isLinuxDesktop, isMacDesktop } from "@/lib/platform";
import type { Settings } from "@/lib/settings";

export function useMpvEmbed(params: { engine: "html5" | "mpv"; settings: Settings }) {
  const { engine, settings } = params;

  useEffect(() => {
    const needsTransparentWebView = isLinuxDesktop() || isMacDesktop();
    if (engine !== "mpv" || !settings.playerMpvEmbed || !needsTransparentWebView) return;
    document.documentElement.dataset.mpvEmbed = "1";
    return () => {
      delete document.documentElement.dataset.mpvEmbed;
    };
  }, [engine, settings.playerMpvEmbed]);

  useEffect(() => {
    if (engine !== "mpv" || !settings.playerMpvEmbed) return;
    let unMove: (() => void) | null = null;
    let unResize: (() => void) | null = null;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        unMove = await win.onMoved(() => void modalOverlaySync());
        unResize = await win.onResized(() => void modalOverlaySync());
      } catch {}
    })();
    return () => {
      unMove?.();
      unResize?.();
      void modalOverlayClose();
    };
  }, [engine, settings.playerMpvEmbed]);
}
