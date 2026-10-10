import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { notifyMediaSeeked } from "@/lib/media-session";

export function usePendingSeekApply(params: {
  pendingSeekSec: number | null;
  clearPendingSeek: () => void;
  durationSec: number;
  bridgeRef: RefObject<PlayerBridge | null>;
  inRoomRef: RefObject<boolean>;
  sourceKey: string;
  startPaused?: boolean;
}) {
  const {
    pendingSeekSec,
    clearPendingSeek,
    durationSec,
    bridgeRef,
    inRoomRef,
    sourceKey,
    startPaused,
  } = params;
  const onApplied = useRef(clearPendingSeek);
  onApplied.current = clearPendingSeek;
  useEffect(() => {
    if (pendingSeekSec == null) return;
    if (durationSec <= 0) return;
    const b = bridgeRef.current;
    if (!b) return;
    const target = pendingSeekSec;
    const t = target <= 5 || target >= durationSec - 20 ? 0 : Math.min(target, durationSec - 1);
    let issued = false;
    let applied = false;
    const off = b.subscribe((snap) => {
      // seek() queues a native command. Keep automatic intro/outro actions blocked
      // until the player reports the requested position, including while paused.
      if (
        !issued ||
        applied ||
        bridgeRef.current !== b ||
        snap.status === "loading" ||
        !Number.isFinite(snap.positionSec) ||
        Math.abs(snap.positionSec - t) > 1
      )
        return;
      applied = true;
      notifyMediaSeeked(t);
      onApplied.current();
      if (!inRoomRef.current && !startPaused) b.play().catch(() => {});
    });
    issued = true;
    b.seek(t);
    return off;
  }, [pendingSeekSec, durationSec, bridgeRef, inRoomRef, sourceKey, startPaused]);
}
