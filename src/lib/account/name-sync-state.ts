import type { NameSyncPhase } from "./name-sync-session";

type NameSyncState = { accountId: string | null; phase: NameSyncPhase };
let state: NameSyncState = { accountId: null, phase: "idle" };
const listeners = new Set<() => void>();
let retry: (() => void) | null = null;

export const getNameSyncState = () => state;
export function subscribeNameSyncState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function bindNameSyncState(accountId: string, onRetry: () => void) {
  const binding = onRetry;
  retry = binding;
  const publish = (phase: NameSyncPhase) => {
    if (retry !== binding) return;
    state = { accountId, phase };
    for (const listener of listeners) listener();
  };
  publish("idle");
  return {
    publish,
    dispose() {
      if (retry !== binding) return;
      retry = null;
      state = { accountId: null, phase: "idle" };
      for (const listener of listeners) listener();
    },
  };
}

export function retryNameSync() {
  retry?.();
}
