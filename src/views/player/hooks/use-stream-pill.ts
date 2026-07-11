import type { PlayerSnapshot } from "@/lib/player/bridge";
import { useEffect, useState } from "react";

export function useStreamPill(params: {
  srcUrl: string;
  snap: PlayerSnapshot;
  pipMode: boolean;
  showWaiting: boolean;
  isLocalSrc: boolean;
  slowLoad: boolean;
  inRoom: boolean;
  streamCheckOpen: boolean;
}): "check" | "stalled" | "failed" | null {
  const { srcUrl, snap, pipMode, showWaiting, isLocalSrc, slowLoad, inRoom, streamCheckOpen } = params;
  const [pillSuppressed, setPillSuppressed] = useState(true);
  useEffect(() => {
    setPillSuppressed(true);
    const t = window.setTimeout(() => setPillSuppressed(false), 2500);
    return () => window.clearTimeout(t);
  }, [srcUrl]);

  return pipMode || showWaiting || snap.status === "ended" || isLocalSrc
    ? null
    : snap.errorCode != null && snap.status === "error" && !pillSuppressed
      ? "failed"
      : slowLoad && !inRoom
        ? "stalled"
        : streamCheckOpen
          ? "check"
          : null;
}
