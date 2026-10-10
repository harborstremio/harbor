import { useSyncExternalStore } from "react";

let urls = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Mirror the main player's state in the separate native subtitle window. */
export function replaceAddedSubs(next: string[]): void {
  urls = new Set(next);
  emit();
}

export function markAddedSub(url: string): void {
  if (!url || urls.has(url)) return;
  urls = new Set(urls);
  urls.add(url);
  emit();
}

export function useAddedSubs(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => urls,
    () => urls,
  );
}
