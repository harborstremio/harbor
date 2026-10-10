import { useEffect, useState, useSyncExternalStore } from "react";
import { QUEUE_STALE_MS, getSyncStatus, isQueueStale, subscribeSyncStatus } from "./status";
import type { SyncStatus } from "./types";

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

/**
 * Nothing appears while a push is merely in flight. The glyph is for a queue that has
 * genuinely been stuck for a minute, which is a different fact from "busy right now".
 */
export function useSyncQueueStale(): boolean {
  const status = useSyncStatus();
  const [stale, setStale] = useState(() => isQueueStale(status, Date.now()));
  useEffect(() => {
    const evaluate = () => setStale(isQueueStale(getSyncStatus(), Date.now()));
    evaluate();
    if (status.queuedSince == null) return;
    const timer = window.setInterval(evaluate, 10000);
    return () => window.clearInterval(timer);
  }, [status.queuedSince, status.queued]);
  return stale;
}

export { QUEUE_STALE_MS };
