import { useSyncExternalStore } from "react";
import { listen } from "@tauri-apps/api/event";

export type AsrModelProgress = { received: number; total: number; active: boolean };

const IDLE: AsrModelProgress = { received: 0, total: 0, active: false };

let state: AsrModelProgress = IDLE;
const listeners = new Set<() => void>();
let started = false;
let clearTimer: number | null = null;

function set(next: AsrModelProgress): void {
  state = next;
  listeners.forEach((l) => l());
}

function ensureListener(): void {
  if (started) return;
  started = true;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  void listen<[number, number]>("asr-model://progress", (e) => {
    const [received, total] = Array.isArray(e.payload) ? e.payload : [0, 0];
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (total > 0 && received >= total) {
      set({ received, total, active: false });
      clearTimer = window.setTimeout(() => set(IDLE), 600);
      return;
    }
    set({ received, total, active: received > 0 });
  });
}

export function useAsrModelProgress(): AsrModelProgress {
  return useSyncExternalStore(
    (cb) => {
      ensureListener();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => IDLE,
  );
}
