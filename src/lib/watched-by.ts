import { useCallback, useSyncExternalStore } from "react";
import {
  capWatchedBy,
  normalizeWatchedBy,
  WATCHED_BY_MAX,
  type WatchedByMap,
} from "@/lib/profile-sync/watched-by-merge";

const KEY = "harbor.watchedby.v1";

// The on-disk value is {mediaId: {p, t}}. It used to be {mediaId: profileId} and
// profile-sync writes the new shape, so both have to be readable forever: a
// device that syncs before it next writes will find {p, t} under a key it wrote
// as a bare string. normalizeWatchedBy accepts either. The previous reader cast
// the parse straight to Record<string, string>, so the object form flowed
// through getWatchedBy typed as a string, compared unequal to every profile id,
// and every watcher avatar silently disappeared with a green build.
let cache: WatchedByMap | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

function read(): WatchedByMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = normalizeWatchedBy(raw ? JSON.parse(raw) : null);
  } catch {
    cache = {};
  }
  return cache;
}

/** Drop the memo so the next read comes off disk. Sync and profile switches both need this. */
export function invalidateWatchedBy(): void {
  cache = null;
  emit();
}

export function subscribeWatchedBy(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function recordWatchedBy(mediaId: string | null, profileId: string | null): void {
  if (!mediaId || !profileId) return;
  const map = read();
  const prev = map[mediaId];
  if (prev && prev.p === profileId) return;
  // Eviction sorts by recency inside capWatchedBy. The old store evicted in
  // insertion order, so a full map could drop last night's episode and keep
  // something from months ago.
  const next = capWatchedBy({ ...map, [mediaId]: { p: profileId, t: Date.now() } }, WATCHED_BY_MAX);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota. The in-memory copy still serves this session.
  }
  emit();
}

export function getWatchedBy(mediaId: string): string | null {
  return read()[mediaId]?.p ?? null;
}

/** The whole map, for the sync section adapter. */
export function readWatchedByMap(): WatchedByMap {
  return read();
}

export function replaceWatchedByMap(next: WatchedByMap): void {
  cache = capWatchedBy(next, WATCHED_BY_MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Quota. The in-memory copy still serves this session.
  }
  emit();
}

/**
 * Reactive read. Card surfaces must use this rather than getWatchedBy: the plain
 * accessor called during render is a localStorage hit plus a JSON.parse of up to
 * 300 entries per card per render, and it subscribes to nothing, so a watch
 * recorded by another profile never repaints.
 */
export function useWatchedBy(mediaId: string, fallbackId?: string | null): string | null {
  const snapshot = useCallback(
    () => getWatchedBy(mediaId) ?? (fallbackId ? getWatchedBy(fallbackId) : null),
    [mediaId, fallbackId],
  );
  return useSyncExternalStore(subscribeWatchedBy, snapshot);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === null) invalidateWatchedBy();
  });
}
