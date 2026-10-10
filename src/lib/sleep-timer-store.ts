import { useSyncExternalStore } from "react";

export type SleepMode =
  | { kind: "off" }
  | { kind: "minutes"; total: number; firesAt: number }
  | { kind: "end_episode" }
  | { kind: "end_next_episode"; remaining: number };

let mode: SleepMode = { kind: "off" };
let remainingMs: number | null = null;
let tickId: number | null = null;
let fireHandler: (() => void) | null = null;
const subs = new Set<() => void>();

function emit() {
  for (const s of subs) s();
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

function stopTick() {
  if (tickId != null) {
    window.clearInterval(tickId);
    tickId = null;
  }
}

function tick() {
  if (mode.kind !== "minutes") {
    stopTick();
    return;
  }
  const r = mode.firesAt - Date.now();
  remainingMs = Math.max(0, r);
  if (r <= 0) {
    stopTick();
    mode = { kind: "off" };
    remainingMs = null;
    fireHandler?.();
  }
  emit();
}

function startTick() {
  stopTick();
  tick();
  if (mode.kind === "minutes") tickId = window.setInterval(tick, 1000);
}

export function getSleepMode(): SleepMode {
  return mode;
}

export function setSleepMode(next: SleepMode): void {
  if (next.kind === "minutes") {
    mode = { kind: "minutes", total: next.total, firesAt: Date.now() + next.total * 60_000 };
    startTick();
  } else {
    stopTick();
    remainingMs = null;
    mode =
      next.kind === "end_next_episode"
        ? { kind: "end_next_episode", remaining: Math.max(1, Math.round(next.remaining || 2)) }
        : next;
  }
  emit();
}

export function clearSleepMode(): void {
  stopTick();
  mode = { kind: "off" };
  remainingMs = null;
  emit();
}

export function registerSleepFireHandler(h: (() => void) | null): void {
  fireHandler = h;
}

export function useSleepMode(): SleepMode {
  return useSyncExternalStore(subscribe, () => mode, () => mode);
}

export function useSleepRemainingMs(): number | null {
  return useSyncExternalStore(subscribe, () => remainingMs, () => remainingMs);
}
