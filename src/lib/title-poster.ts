import { useSyncExternalStore } from "react";

const STORAGE_KEY = "harbor:title-posters";

type Store = Record<string, string>;

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

let cache: Store = read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getTitlePoster(metaId: string): string | undefined {
  return cache[metaId];
}

export function setTitlePoster(metaId: string, url: string): void {
  if (cache[metaId] === url) return;
  cache = { ...cache, [metaId]: url };
  persist();
  emit();
}

export function clearTitlePoster(metaId: string): void {
  if (!(metaId in cache)) return;
  const next = { ...cache };
  delete next[metaId];
  cache = next;
  persist();
  emit();
}

export function useTitlePoster(metaId: string | undefined): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (metaId ? cache[metaId] : undefined),
    () => undefined,
  );
}
