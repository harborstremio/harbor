import { useSyncExternalStore } from "react";
type Status = { phase: "idle" | "syncing" | "pending"; message: string };
let status: Status = {
  phase: "idle",
  message: "Changes stay on this device until a JL profile is linked.",
};
const listeners = new Set<() => void>();
export function setJlSyncStatus(next: Status): void {
  status = next;
  for (const listener of listeners) listener();
}
export function useJlSyncStatus(): Status {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => status,
  );
}
