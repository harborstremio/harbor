import { useEffect, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { notifyMediaSeeked } from "@/lib/media-session";

export function usePendingSeekApply(params: {
  pendingSeekSec: number | null;
  preserveExactPosition?: boolean;
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
    const t =
      !params.preserveExactPosition && (target <= 5 || target >= durationSec - 20)
        ? 0
        : Math.max(0, Math.min(target, durationSec - 1));
    b.seek(t);
    notifyMediaSeeked(t);
    if (!inRoomRef.current) b.play().catch(() => {});
  }, [pendingSeekSec, durationSec, clearPendingSeek, params.preserveExactPosition]);
}
