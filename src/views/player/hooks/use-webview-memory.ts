import { useEffect } from "react";
import { pulseWebviewMemoryLow } from "@/lib/webview-memory";
import { runMaintenance } from "@/lib/maintenance";

const POST_PLAYBACK_MAINTENANCE_DELAY_MS = 1500;
let pendingPostPlaybackMaintenance: number | null = null;

export function useWebviewMemory(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (pendingPostPlaybackMaintenance != null) {
      window.clearTimeout(pendingPostPlaybackMaintenance);
      pendingPostPlaybackMaintenance = null;
    }
    return () => {
      pendingPostPlaybackMaintenance = window.setTimeout(() => {
        pendingPostPlaybackMaintenance = null;
        pulseWebviewMemoryLow();
        runMaintenance(true);
      }, POST_PLAYBACK_MAINTENANCE_DELAY_MS);
    };
  }, [active]);
}
