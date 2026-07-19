import { useEffect } from "react";
import { modalOverlayClose, modalOverlaySync } from "@/lib/modal-overlay";
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import type { Settings } from "@/lib/settings";

async function invokeWebviewBg(command: "webview_reapply_transparency" | "webview_set_opaque") {
  if (!("__TAURI_INTERNALS__" in window)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(command);
  } catch {
    /* not tauri / command unavailable */
  }
}

export function useMpvEmbed(params: { engine: "html5" | "mpv"; settings: Settings }) {
  const { engine, settings } = params;

  useEffect(() => {
    const needsTransparentWebView = isLinuxDesktop() || isMacDesktop() || isWindowsDesktop();
    if (engine !== "mpv" || !settings.playerMpvEmbed || !needsTransparentWebView) return;
    document.documentElement.dataset.mpvEmbed = "1";
    // Windows: only make WebView2 transparent while embedded mpv is active.
    if (isWindowsDesktop()) {
      void invokeWebviewBg("webview_reapply_transparency");
    }
    return () => {
      delete document.documentElement.dataset.mpvEmbed;
      if (isWindowsDesktop()) {
        void invokeWebviewBg("webview_set_opaque");
      }
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
