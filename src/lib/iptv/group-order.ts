import { useSyncExternalStore } from "react";

export type GroupPrefs = { pinned: string[]; hidden: string[] };

const KEY = "harbor.iptv.groupPrefs.v1";
const EMPTY: GroupPrefs = { pinned: [], hidden: [] };

let cache: Record<string, GroupPrefs> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, GroupPrefs> {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cache = parsed && typeof parsed === "object" ? (parsed as Record<string, GroupPrefs>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(next: Record<string, GroupPrefs>) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  for (const l of listeners) l();
}

function update(sourceId: string, fn: (p: GroupPrefs) => GroupPrefs) {
  if (!sourceId) return;
  const map = { ...load() };
  map[sourceId] = fn(map[sourceId] ?? EMPTY);
  persist(map);
}

export function toggleGroupPin(sourceId: string, group: string): void {
  update(sourceId, (p) => ({
    pinned: p.pinned.includes(group) ? p.pinned.filter((g) => g !== group) : [...p.pinned, group],
    hidden: p.hidden.filter((g) => g !== group),
  }));
}

export function toggleGroupHidden(sourceId: string, group: string): void {
  update(sourceId, (p) => ({
    pinned: p.pinned.filter((g) => g !== group),
    hidden: p.hidden.includes(group) ? p.hidden.filter((g) => g !== group) : [...p.hidden, group],
  }));
}

/** Hide or unhide many groups at once (Live TV multi-select). */
export function setGroupsHidden(sourceId: string, groups: string[], hidden: boolean): void {
  if (!sourceId || groups.length === 0) return;
  const want = new Set(groups);
  update(sourceId, (p) => {
    if (hidden) {
      const nextHidden = [...p.hidden];
      for (const g of want) {
        if (!nextHidden.includes(g)) nextHidden.push(g);
      }
      return {
        pinned: p.pinned.filter((g) => !want.has(g)),
        hidden: nextHidden,
      };
    }
    return {
      pinned: p.pinned,
      hidden: p.hidden.filter((g) => !want.has(g)),
    };
  });
}

/** Pin many groups at once (Live TV multi-select). Does not toggle — always pins. */
export function setGroupsPinned(sourceId: string, groups: string[], pinned: boolean): void {
  if (!sourceId || groups.length === 0) return;
  const want = new Set(groups);
  update(sourceId, (p) => {
    if (pinned) {
      const nextPinned = [...p.pinned];
      for (const g of want) {
        if (!nextPinned.includes(g)) nextPinned.push(g);
      }
      return {
        pinned: nextPinned,
        hidden: p.hidden.filter((g) => !want.has(g)),
      };
    }
    return {
      pinned: p.pinned.filter((g) => !want.has(g)),
      hidden: p.hidden,
    };
  });
}

export function clearGroupPrefs(sourceId: string): void {
  update(sourceId, () => ({ pinned: [], hidden: [] }));
}

export function removeGroupPrefs(sourceId: string): void {
  if (!sourceId) return;
  const map = load();
  if (!(sourceId in map)) return;
  const next = { ...map };
  delete next[sourceId];
  persist(next);
}

export function useGroupPrefs(sourceId: string): GroupPrefs {
  const map = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    load,
    load,
  );
  return map[sourceId] ?? EMPTY;
}
