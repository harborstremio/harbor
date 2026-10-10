import { useSyncExternalStore } from "react";

let editing = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function setNavEditMode(next: boolean): void {
  if (editing === next) return;
  editing = next;
  try {
    if (next) document.documentElement.dataset.navEditing = "true";
    else delete document.documentElement.dataset.navEditing;
  } catch {}
  notify();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): boolean {
  return editing;
}

export function useNavEditMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
