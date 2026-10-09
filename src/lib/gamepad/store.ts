import { useSyncExternalStore } from "react";
import type { GamepadInfo } from "./protocol";

export type { GamepadInfo } from "./protocol";

let gamepads: GamepadInfo[] = [];
const listeners = new Set<() => void>();

export function publishGamepads(list: GamepadInfo[]): void {
  gamepads = list;
  for (const notify of listeners) notify();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): GamepadInfo[] {
  return gamepads;
}

export function useGamepads(): GamepadInfo[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
