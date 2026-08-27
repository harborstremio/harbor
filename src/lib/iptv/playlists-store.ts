import { useSyncExternalStore } from "react";
import { setItemWithRecovery } from "@/lib/storage-recovery";

export type StoredPlaylist = {
  id: string;
  name: string;
  url: string;
  epgUrl?: string;
  kind?: "m3u" | "xtream" | "epg";
  xtream?: { server: string; username: string; password: string };
};

const STORAGE_KEY = "harbor.iptv.playlists.v1";

let migrated = false;
let cache: StoredPlaylist[] = [];
let cacheJson = "[]";
const subs = new Set<() => void>();

function notify(): void {
  for (const fn of subs) fn();
}

function ensureMigrated(): void {
  if (!migrated) migrateLegacyPlaylists();
}

/**
 * Moves playlists out of the settings blob (harbor.settings.*) into their own
 * key. Runs once per session. Legacy lists are merged from every settings blob
 * (deduped by id, stored entries win) and the legacy field is stripped only
 * after the dedicated key has been persisted, so a failed write never destroys
 * the only surviving copy.
 */
export function migrateLegacyPlaylists(): void {
  if (migrated) return;
  migrated = true;
  try {
    if (localStorage.getItem(STORAGE_KEY) != null) return;
  } catch {
    return;
  }
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const key of ["harbor.settings.shared", "harbor.settings"]) {
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(key);
    }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("harbor.settings.") && !seen.has(key)) {
        seen.add(key);
        candidates.push(key);
      }
    }
  } catch {
    /* localStorage enumeration is best-effort */
  }
  const merged = new Map<string, StoredPlaylist>();
  const dirty: Array<{ key: string; obj: Record<string, unknown> }> = [];
  for (const key of candidates) {
    let blob: unknown;
    try {
      blob = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      continue;
    }
    if (!blob || typeof blob !== "object") continue;
    const obj = blob as Record<string, unknown>;
    if (!("iptvPlaylists" in obj)) continue;
    if (Array.isArray(obj.iptvPlaylists)) {
      for (const entry of obj.iptvPlaylists as StoredPlaylist[]) {
        if (entry && typeof entry.id === "string" && !merged.has(entry.id)) {
          merged.set(entry.id, entry);
        }
      }
    }
    dirty.push({ key, obj });
  }
  if (merged.size === 0) return;
  const lists = [...merged.values()];
  const json = JSON.stringify(lists);
  try {
    if (!setItemWithRecovery(STORAGE_KEY, json)) return;
  } catch {
    return;
  }
  cache = lists;
  cacheJson = json;
  // Strip the legacy field only now that the dedicated key is persisted, so the
  // playlists no longer export under Settings.
  for (const { key, obj } of dirty) {
    try {
      delete obj.iptvPlaylists;
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Adopts a stranded legacy iptvPlaylists array into the dedicated store key,
 * merging with anything already stored (stored entries win). Returns whether
 * the result was persisted; callers should only drop the legacy field on true.
 */
export function adoptLegacyPlaylists(legacy: StoredPlaylist[]): boolean {
  if (!Array.isArray(legacy) || legacy.length === 0) return true;
  const merged = new Map<string, StoredPlaylist>();
  for (const entry of cache) merged.set(entry.id, entry);
  for (const entry of legacy) {
    if (entry && typeof entry.id === "string" && !merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }
  return writePlaylists([...merged.values()]);
}

export function readPlaylists(): StoredPlaylist[] {
  ensureMigrated();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const lists = parsed as StoredPlaylist[];
    if (raw !== cacheJson) {
      cache = lists;
      cacheJson = raw;
    }
    return lists;
  } catch {
    return [];
  }
}

export function writePlaylists(playlists: StoredPlaylist[]): boolean {
  cache = playlists;
  cacheJson = JSON.stringify(playlists);
  let persisted = false;
  try {
    persisted = setItemWithRecovery(STORAGE_KEY, cacheJson);
  } catch (e) {
    console.warn("[playlists] storage write failed", e);
  }
  if (!persisted) {
    console.warn(`[playlists] storage is full; not persisted (${playlists.length} playlists)`);
  }
  notify();
  return persisted;
}

export function subscribePlaylists(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

// Hydrate the module cache at import time so usePlaylists() consumers render the
// stored playlists without depending on a one-time migration flag being tripped.
readPlaylists();

export function usePlaylists(): StoredPlaylist[] {
  return useSyncExternalStore(
    subscribePlaylists,
    () => cache,
    () => cache,
  );
}
