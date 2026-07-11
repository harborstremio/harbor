import { useSyncExternalStore } from "react";

import { isMovieWatchedLocal, subscribeMovieWatched } from "./movie-watched";

const KEY = "harbor.watchedFlag.v1";

const subs = new Set<() => void>();
let version = 0;
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist(next: Set<string>): void {
  cache = next;
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* quota */
  }
  for (const fn of subs) fn();
}

export function isWatchedFlagged(metaId: string): boolean {
  return load().has(metaId);
}

export function setWatchedFlag(metaId: string, watched: boolean): void {
  const cur = load();
  if (cur.has(metaId) === watched) return;
  const next = new Set(cur);
  if (watched) next.add(metaId);
  else next.delete(metaId);
  persist(next);
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  const offMovie = subscribeMovieWatched(fn);
  return () => {
    subs.delete(fn);
    offMovie();
  };
}

export function useMetaWatched(metaId: string | undefined, type: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!metaId) return false;
      if (load().has(metaId)) return true;
      return type === "movie" && isMovieWatchedLocal(metaId);
    },
    () => false,
  );
}
