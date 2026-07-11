import { runMaintenance } from "@/lib/maintenance";
import { pulseWebviewMemoryLow } from "@/lib/webview-memory";
import { useEffect } from "react";

const TRIM_INTERVAL_MS = 60000;

export function useWebviewMemory(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => pulseWebviewMemoryLow(), TRIM_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      pulseWebviewMemoryLow();
      runMaintenance(true);
    };
  }, [active]);
}
