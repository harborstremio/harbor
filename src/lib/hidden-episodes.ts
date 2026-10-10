import { useSyncExternalStore } from "react";
import { persistCritical } from "@/lib/storage-recovery";

const KEY = "harbor.hiddenepisodes.v1";

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

function key(metaId: string, season: number, episode: number): string {
  return `${metaId}|${season}|${episode}`;
}

function persist(next: Set<string>): void {
  cache = next;
  persistCritical(KEY, JSON.stringify([...next]));
  version += 1;
  for (const fn of subs) fn();
}

export function isEpisodeHidden(metaId: string, season: number, episode: number): boolean {
  return load().has(key(metaId, season, episode));
}

export function setEpisodeHidden(metaId: string, season: number, episode: number, hidden: boolean): void {
  const set = load();
  const k = key(metaId, season, episode);
  if (set.has(k) === hidden) return;
  const next = new Set(set);
  if (hidden) next.add(k);
  else next.delete(k);
  persist(next);
}

export function hiddenKeysFor(metaId: string): Set<string> {
  const prefix = `${metaId}|`;
  const out = new Set<string>();
  for (const k of load()) {
    if (!k.startsWith(prefix)) continue;
    const parts = k.split("|");
    if (parts.length === 3) out.add(`${parts[1]}:${parts[2]}`);
  }
  return out;
}

export function clearHiddenForShow(metaId: string): void {
  const prefix = `${metaId}|`;
  const set = load();
  let changed = false;
  const next = new Set(set);
  for (const k of set) {
    if (k.startsWith(prefix)) {
      next.delete(k);
      changed = true;
    }
  }
  if (changed) persist(next);
}

export function subscribeHiddenEpisodes(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function hiddenEpisodesVersion(): number {
  return version;
}

export function useHiddenEpisodes(metaId: string): Set<string> {
  useSyncExternalStore(subscribeHiddenEpisodes, hiddenEpisodesVersion, hiddenEpisodesVersion);
  return hiddenKeysFor(metaId);
}
