import type { SyncStatus } from "./types";

export const QUEUE_STALE_MS = 60000;

/**
 * Phases are enum values, never sentences. Every consumer renders them through useBpT so
 * a Portuguese TV does not show an English fallback baked in at this layer.
 */
const initial: SyncStatus = {
  phase: "off",
  armed: false,
  rosterWired: false,
  everPulled: false,
  queued: 0,
  queuedSince: null,
  lastPullAt: 0,
  lastPushAt: 0,
  lastError: null,
};

let current: SyncStatus = initial;
const subs = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return current;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function patchSyncStatus(patch: Partial<SyncStatus>): void {
  let changed = false;
  for (const [k, v] of Object.entries(patch) as Array<[keyof SyncStatus, unknown]>) {
    if (current[k] !== v) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  current = { ...current, ...patch };
  for (const fn of subs) fn();
}

export function resetSyncStatus(): void {
  current = initial;
  for (const fn of subs) fn();
}

/**
 * Nothing is shown while a push is merely in flight: writes normally land inside a
 * second and a flickering dot is noise on a screen somebody is watching a film on.
 */
export function isQueueStale(status: SyncStatus, now: number): boolean {
  return status.queuedSince != null && now - status.queuedSince > QUEUE_STALE_MS;
}

/**
 * A6. The chooser must not invite a user to build a second household on a device that is
 * about to receive the first one, so the roster stays read only until the first pull for
 * this account has either landed or definitively failed.
 */
export function rosterWritable(status: SyncStatus): boolean {
  if (!status.armed) return true;
  if (status.everPulled) return true;
  return status.phase === "first-pull-failed";
}
