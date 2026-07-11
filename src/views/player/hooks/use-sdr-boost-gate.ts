import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

export function useSdrBoostGate(params: { engine: "html5" | "mpv"; hdrGamma: string; enabled: boolean }) {
  const { engine, hdrGamma, enabled } = params;
  useEffect(() => {
    if (engine !== "mpv" || !enabled) return;
    if (!hdrGamma) return;
    const isHdr = hdrGamma === "pq" || hdrGamma === "hlg";
    void invoke("mpv_set_property", { name: "inverse-tone-mapping", value: isHdr ? "no" : "yes" }).catch(() => {});
  }, [engine, hdrGamma, enabled]);
}
