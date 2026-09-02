import { useSyncExternalStore } from "react";
import { requestSyncPull, useSyncStatus } from "@/lib/profile-sync";

/**
 * The chooser's view of the account sync engine, DERIVED from the engine's own status
 * rather than pushed into from outside.
 *
 * It began as a port with setBpWhoSyncPhase / setBpWhoSyncRetry for the engine to call.
 * Nothing ever called them, so the phase was hardcoded "idle" with no writer and the
 * "signing in" and "could not reach Harbor" lines were unreachable strings: a new
 * television mid-first-pull showed one fabricated Guest tile and invited the user to
 * pick it as though it were their household. The engine publishes a real SyncStatus, so
 * this reads that and the two cannot drift.
 *
 * "pending" is the FIRST pull only. A device that has synced before holds a complete
 * local copy and must show no chrome at all.
 */
export type BpWhoSyncPhase = "idle" | "pending" | "failed";

let phase: BpWhoSyncPhase = "idle";
let retry: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bpWhoSyncPhase(): BpWhoSyncPhase {
  return phase;
}

/**
 * Called by the sync engine. "pending" only while the FIRST pull on this account
 * has not landed on this device, never for an ordinary refresh: a device that has
 * synced before holds a complete local copy and must show no chrome at all.
 */
export function setBpWhoSyncPhase(next: BpWhoSyncPhase): void {
  if (next === phase) return;
  phase = next;
  emit();
}

export function bpWhoSyncCanRetry(): boolean {
  return retry !== null;
}

export function setBpWhoSyncRetry(fn: (() => void) | null): void {
  if (fn === retry) return;
  retry = fn;
  emit();
}

export function runBpWhoSyncRetry(): void {
  retry?.();
}

export function useBpWhoSyncPhase(): BpWhoSyncPhase {
  const status = useSyncStatus();
  const pushed = useSyncExternalStore(subscribe, bpWhoSyncPhase, bpWhoSyncPhase);
  if (pushed !== "idle") return pushed;
  if (!status.armed) return "idle";
  if (status.phase === "first-pull") return "pending";
  if (status.phase === "first-pull-failed") return "failed";
  return "idle";
}

export function useBpWhoSyncCanRetry(): boolean {
  const phase = useBpWhoSyncPhase();
  const pushed = useSyncExternalStore(subscribe, bpWhoSyncCanRetry, bpWhoSyncCanRetry);
  return pushed || phase === "failed";
}

/** Retry falls back to the engine's own pull when nobody registered a handler. */
export function runBpWhoRetry(): void {
  if (bpWhoSyncCanRetry()) {
    runBpWhoSyncRetry();
    return;
  }
  requestSyncPull();
}
