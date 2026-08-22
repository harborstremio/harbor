import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";

export type QueueItem = {
  id: string;
  meta: Meta;
  episode?: PlayEpisode;
  addedAt: number;
};

const KEY = "harbor.queue.v1";
const SLEEP_KEY = "harbor.queue.sleepAtEnd.v1";

let items: QueueItem[] = load();
const listeners = new Set<() => void>();

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function rid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function keyOf(meta: Meta, episode?: PlayEpisode): string {
  return `${meta.id}${episode ? `:${episode.season}:${episode.episode}` : ""}`;
}

export function queueAdd(meta: Meta, episode?: PlayEpisode): void {
  const k = keyOf(meta, episode);
  if (items.some((i) => keyOf(i.meta, i.episode) === k)) return;
  items = [...items, { id: rid(), meta, episode, addedAt: Date.now() }];
  persist();
}

export function queueRemove(id: string): void {
  items = items.filter((i) => i.id !== id);
  persist();
}

export function queueToggle(meta: Meta, episode?: PlayEpisode): void {
  const k = keyOf(meta, episode);
  const existing = items.find((i) => keyOf(i.meta, i.episode) === k);
  if (existing) queueRemove(existing.id);
  else queueAdd(meta, episode);
}

export function queueClear(): void {
  if (items.length === 0) return;
  items = [];
  persist();
}

export function queueReorder(orderedIds: string[]): void {
  const pos = new Map(orderedIds.map((id, i) => [id, i] as const));
  items = [...items].sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
  persist();
}

export function queueIndexOf(meta: Meta, episode?: PlayEpisode): number {
  const key = keyOf(meta, episode);
  return items.findIndex((item) => keyOf(item.meta, item.episode) === key);
}

export function queueItemAfter(meta: Meta, episode?: PlayEpisode): QueueItem | null {
  const index = queueIndexOf(meta, episode);
  if (index < 0) return null;
  return items[index + 1] ?? null;
}

export function queueItemBefore(meta: Meta, episode?: PlayEpisode): QueueItem | null {
  const index = queueIndexOf(meta, episode);
  if (index <= 0) return null;
  return items[index - 1] ?? null;
}

export function queueCompleteCurrent(meta: Meta, episode?: PlayEpisode): QueueItem | null {
  const index = queueIndexOf(meta, episode);
  if (index < 0) return null;
  const next = items[index + 1] ?? null;
  items = items.filter((_, itemIndex) => itemIndex !== index);
  persist();
  return next;
}

export function queueShift(): QueueItem | null {
  const first = items[0] ?? null;
  if (first) {
    items = items.slice(1);
    persist();
  }
  return first;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useQueue(): QueueItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}

export function useIsQueued(meta: Meta, episode?: PlayEpisode): boolean {
  const q = useQueue();
  const k = keyOf(meta, episode);
  return q.some((i) => keyOf(i.meta, i.episode) === k);
}

export function getSleepAtEnd(): boolean {
  try {
    return localStorage.getItem(SLEEP_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSleepAtEnd(on: boolean): void {
  try {
    if (on) localStorage.setItem(SLEEP_KEY, "1");
    else localStorage.removeItem(SLEEP_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useSleepAtEnd(): boolean {
  return useSyncExternalStore(subscribe, getSleepAtEnd, getSleepAtEnd);
}
