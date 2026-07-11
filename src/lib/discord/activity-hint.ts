import { useSyncExternalStore } from "react";

import type { BrowsePresence } from "./presence";

type Entry = { id: number; hint: BrowsePresence };

let stack: Entry[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function pushActivityHint(hint: BrowsePresence): () => void {
  const id = ++seq;
  stack = [...stack, { id, hint }];
  emit();
  return () => {
    const next = stack.filter((e) => e.id !== id);
    if (next.length !== stack.length) {
      stack = next;
      emit();
    }
  };
}

function getTop(): BrowsePresence | null {
  return stack.length > 0 ? stack[stack.length - 1].hint : null;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useActivityHint(): BrowsePresence | null {
  return useSyncExternalStore(subscribe, getTop, getTop);
}
