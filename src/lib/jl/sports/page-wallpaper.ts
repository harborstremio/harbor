import { useSyncExternalStore } from "react";

/**
 * The Sports page's pinned wallpaper: the hero art the viewer pinned behind the page while no
 * video is playing. A per-device convenience, kept in local storage. The owner's art is stored
 * by its key (its signed link changes), any other picture by its URL.
 */
export type PinnedWallpaper = { key: string | null; url: string | null; label: string };

const STORAGE_KEY = "jl.sports.pageWallpaper.v1";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: PinnedWallpaper | null } | null = null;

function parse(raw: string | null): PinnedWallpaper | null {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<PinnedWallpaper>) : null;
    if (!v || typeof v.label !== "string") return null;
    const key = typeof v.key === "string" && v.key ? v.key : null;
    const url =
      typeof v.url === "string" && /^(https?:|data:image\/|\/)/.test(v.url) ? v.url : null;
    return key || url ? { key, url, label: v.label } : null;
  } catch {
    return null;
  }
}

export function readPinnedWallpaper(): PinnedWallpaper | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = cache?.raw ?? null;
  }
  if (cache?.raw === raw) return cache.value;
  cache = { raw, value: parse(raw) };
  return cache.value;
}

export function setPinnedWallpaper(next: PinnedWallpaper | null): void {
  const raw = next ? JSON.stringify(next) : null;
  try {
    if (raw) localStorage.setItem(STORAGE_KEY, raw);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* kept for this session only */
  }
  cache = { raw, value: next };
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function usePinnedWallpaper(): PinnedWallpaper | null {
  return useSyncExternalStore(subscribe, readPinnedWallpaper, () => null);
}
