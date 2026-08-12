import { useEffect, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";

export function usePendingSeekApply(params: {
  pendingSeekSec: number | null;
  clearPendingSeek: () => void;
  durationSec: number;
  bridgeRef: RefObject<PlayerBridge | null>;
  inRoomRef: RefObject<boolean>;
}) {
  const { pendingSeekSec, clearPendingSeek, durationSec, bridgeRef, inRoomRef } = params;
  useEffect(() => {
    if (pendingSeekSec == null) return;
    if (durationSec <= 0) return;
    const b = bridgeRef.current;
    if (!b) return;
    const target = pendingSeekSec;
    clearPendingSeek();
    const t = target <= 5 || target >= durationSec - 20 ? 0 : Math.min(target, durationSec - 1);
    b.seek(t);
    if (!inRoomRef.current) b.play().catch(() => {});
  }, [pendingSeekSec, durationSec, clearPendingSeek]);
}
