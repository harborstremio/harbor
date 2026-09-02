import { useSyncExternalStore } from "react";

let captured = false;
const subs = new Set<() => void>();

export function setGamepadCapture(on: boolean): void {
  if (captured === on) return;
  captured = on;
  for (const s of subs) s();
}

export function isGamepadCaptured(): boolean {
  return captured;
}

export function useGamepadCapture(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => captured,
    () => false,
  );
}
