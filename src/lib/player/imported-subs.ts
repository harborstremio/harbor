import { useSyncExternalStore } from "react";

let titles = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function markImportedSub(title: string): void {
  if (!title || titles.has(title)) return;
  titles = new Set(titles);
  titles.add(title);
  emit();
}

export function hasImportedSubTitle(title: string | undefined | null): boolean {
  return !!title && titles.has(title);
}

export function clearImportedSubs(): void {
  if (titles.size === 0) return;
  titles = new Set();
  emit();
}

export function useImportedSubs(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => titles,
    () => titles,
  );
}
