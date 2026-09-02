import { useSyncExternalStore } from "react";

const KEY = "harbor.pinnedcatalogs.v1";
const CAP = 12;
const subs = new Set<() => void>();

export type PinnedSource = "catalog" | "anilist" | "simkl" | "mal";

export type PinnedCatalog = {
  id: string;
  source: PinnedSource;
  name: string;
  params: Record<string, string>;
};

export type PinnedBuiltinTitle = {
  key: string;
  valueKey?: string;
};

const LIST_RAIL_TITLE_KEYS: Readonly<Record<string, string>> = {
  watching: "Watching",
  planning: "Plan to Watch",
  completed: "Completed",
  onhold: "On Hold",
  paused: "On Hold",
  dropped: "Dropped",
};

export function pinnedBuiltinTitle(
  source: PinnedSource,
  railKey: string | undefined,
): PinnedBuiltinTitle | null {
  if (!railKey) return null;
  if (source === "anilist") {
    if (railKey === "trending") return { key: "Trending on AniList" };
    if (railKey === "top100") return { key: "Top 100 on AniList" };
    if (railKey === "recommended") return { key: "Recommended for you" };
    const valueKey = LIST_RAIL_TITLE_KEYS[railKey];
    return valueKey ? { key: "Your AniList: {name}", valueKey } : null;
  }
  if (source === "mal") {
    const valueKey = LIST_RAIL_TITLE_KEYS[railKey];
    return valueKey ? { key: "Your MAL: {name}", valueKey } : null;
  }
  return null;
}

let cache: PinnedCatalog[] = load();

function load(): PinnedCatalog[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: PinnedCatalog[] = [];
    for (const el of arr) {
      if (!el || typeof el !== "object") continue;
      const e = el as Partial<PinnedCatalog>;
      if (typeof e.id !== "string" || typeof e.name !== "string") continue;
      if (
        e.source !== "catalog" &&
        e.source !== "anilist" &&
        e.source !== "simkl" &&
        e.source !== "mal"
      )
        continue;
      out.push({
        id: e.id,
        source: e.source,
        name: e.name,
        params:
          e.params && typeof e.params === "object" ? (e.params as Record<string, string>) : {},
      });
    }
    return out.slice(0, CAP);
  } catch {
    return [];
  }
}

function commit(next: PinnedCatalog[]) {
  cache = next.slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  for (const s of subs) s();
}

export function readPinnedCatalogs(): PinnedCatalog[] {
  return cache;
}

export function isPinned(id: string): boolean {
  return cache.some((c) => c.id === id);
}

export function pinnedCount(): number {
  return cache.length;
}

export function pinCatalog(desc: PinnedCatalog): boolean {
  if (isPinned(desc.id)) return true;
  if (cache.length >= CAP) return false;
  commit([...cache, desc]);
  return true;
}

export function unpinCatalog(id: string): void {
  if (!isPinned(id)) return;
  commit(cache.filter((c) => c.id !== id));
}

export function togglePinnedCatalog(desc: PinnedCatalog): boolean {
  if (isPinned(desc.id)) {
    unpinCatalog(desc.id);
    return false;
  }
  return pinCatalog(desc);
}

function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function usePinnedCatalogs(): PinnedCatalog[] {
  return useSyncExternalStore(subscribe, readPinnedCatalogs, readPinnedCatalogs);
}

export function useIsPinned(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isPinned(id),
    () => isPinned(id),
  );
}

export function isPinCapReached(): boolean {
  return cache.length >= CAP;
}

export const PINNED_CATALOGS_CAP = CAP;
