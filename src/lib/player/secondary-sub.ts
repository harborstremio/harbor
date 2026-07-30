import { useSyncExternalStore } from "react";

export type SecondarySubChoice = string | null | "auto";

let choice: SecondarySubChoice = "auto";
const listeners = new Set<() => void>();

function publish(next: SecondarySubChoice): void {
  if (choice === next) return;
  choice = next;
  listeners.forEach((l) => l());
}

export function setSecondarySub(id: string | null): void {
  publish(id);
}

export function resetSecondarySub(): void {
  publish("auto");
}

export function useSecondarySubChoice(): SecondarySubChoice {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => choice,
    (): SecondarySubChoice => "auto",
  );
}
