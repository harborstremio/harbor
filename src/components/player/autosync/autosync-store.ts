import { useSyncExternalStore } from "react";
import type { AutoSyncHandle } from "@/views/player/hooks/use-auto-sync";

let current: AutoSyncHandle | null = null;
const listeners = new Set<() => void>();

export function publishAutoSync(handle: AutoSyncHandle | null): void {
  if (current === handle) return;
  current = handle;
  listeners.forEach((l) => l());
}

export function useAutoSyncHandle(): AutoSyncHandle | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
