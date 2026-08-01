import { useSyncExternalStore } from "react";

// ─── Store ────────────────────────────────────────────────────────────────────

export type SyncBarState = {
  open: boolean;
  initialDelaySec: number;
};

const SERVER_STATE: SyncBarState = { open: false, initialDelaySec: 0 };
let state: SyncBarState = SERVER_STATE;
const listeners = new Set<() => void>();

export function openSyncBar(initialDelaySec = 0): void {
  if (state.open) return;
  state = { open: true, initialDelaySec };
  listeners.forEach((l) => l());
}

export function closeSyncBar(): void {
  if (!state.open) return;
  state = { ...state, open: false };
  listeners.forEach((l) => l());
}

export function toggleSyncBar(initialDelaySec = 0): void {
  if (state.open) closeSyncBar();
  else openSyncBar(initialDelaySec);
}

export function useSyncBarState(): SyncBarState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}

export function useSyncBarOpen(): boolean {
  return useSyncBarState().open;
}
