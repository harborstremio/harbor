import { useCallback, useEffect, useState } from "react";
import type { PlayerSnapshot } from "@/lib/player/bridge";

export type StreamPillVariant = "check" | "stalled" | "failed";

export function resolveStreamPillVariant(input: {
  snap: PlayerSnapshot;
  dismissed: boolean;
  pillSuppressed: boolean;
  pipMode: boolean;
  showWaiting: boolean;
  isLocalSrc: boolean;
  slowLoad: boolean;
  inRoom: boolean;
  streamCheckOpen: boolean;
}): StreamPillVariant | null {
  const {
    snap,
    dismissed,
    pillSuppressed,
    pipMode,
    showWaiting,
    isLocalSrc,
    slowLoad,
    inRoom,
    streamCheckOpen,
  } = input;
  if (dismissed || pipMode || showWaiting || snap.status === "ended" || isLocalSrc) return null;
  if (snap.errorCode != null && snap.status === "error" && !pillSuppressed) return "failed";
  if (slowLoad && !inRoom && !snap.firstFrameReady) return "stalled";
  return streamCheckOpen ? "check" : null;
}

export function useStreamPill(params: {
  srcUrl: string;
  snap: PlayerSnapshot;
  pipMode: boolean;
  showWaiting: boolean;
  isLocalSrc: boolean;
  slowLoad: boolean;
  inRoom: boolean;
  streamCheckOpen: boolean;
}): { variant: StreamPillVariant | null; dismiss: () => void } {
  const { srcUrl, snap, pipMode, showWaiting, isLocalSrc, slowLoad, inRoom, streamCheckOpen } = params;
  const [pillSuppressed, setPillSuppressed] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setPillSuppressed(true);
    setDismissed(false);
    const t = window.setTimeout(() => setPillSuppressed(false), 2500);
    return () => window.clearTimeout(t);
  }, [srcUrl]);
  const dismiss = useCallback(() => setDismissed(true), []);

  const variant = resolveStreamPillVariant({
    snap,
    dismissed,
    pillSuppressed,
    pipMode,
    showWaiting,
    isLocalSrc,
    slowLoad,
    inRoom,
    streamCheckOpen,
  });
  return { variant, dismiss };
}
