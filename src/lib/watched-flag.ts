import { useSyncExternalStore } from "react";
import { isMovieWatchedLocal, subscribeMovieWatched } from "./movie-watched";
import { persistCritical } from "./storage-recovery";

const KEY_PREFIX = "harbor.watchedFlag.v1.";
const LEGACY_KEY = "harbor.watchedFlag.v1";
const PROFILES_KEY = "harbor.profiles.v1";

const subs = new Set<() => void>();
let version = 0;
let cache: Set<string> | null = null;

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean; shareStremioWith?: string | null }>;
    };
    const profiles = Array.isArray(s.profiles) ? s.profiles : [];
    const active = profiles.find((p) => p.id === s.activeId) ?? null;
    const own = active?.id ?? profiles.find((p) => p?.isPrimary)?.id ?? "";
    if (!own) return "";
    if (active && typeof active.shareStremioWith === "string" && active.shareStremioWith) {
      const shared = profiles.find((p) => p.id === active.shareStremioWith);
      if (shared?.id) return shared.id;
    }
    return own;
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
  } catch {
    return activeProfileId();
  }
}

function storeKey(): string {
  const id = activeProfileId();
  return id ? KEY_PREFIX + id : LEGACY_KEY;
}

function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const pid = primaryProfileId();
    if (!pid) return;
    const perKey = KEY_PREFIX + pid;
    if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* noop */
  }
}

function load(): Set<string> {
  if (cache) return cache;
  migrateLegacy();
  try {
    const arr = JSON.parse(localStorage.getItem(storeKey()) ?? "[]");
    cache = new Set(
      Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist(next: Set<string>): void {
  cache = next;
  version += 1;
  persistCritical(storeKey(), JSON.stringify([...next]));
  for (const fn of subs) fn();
}

export function isWatchedFlagged(metaId: string): boolean {
  return load().has(metaId);
}

export function watchedFlagIds(): Set<string> {
  return load();
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

export function useMetaWatched(
  metaId: string | undefined,
  type: string | undefined,
  altId?: string | null,
): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!metaId) return false;
      if (load().has(metaId)) return true;
      if (altId && load().has(altId)) return true;
      if (type === "movie") {
        if (isMovieWatchedLocal(metaId)) return true;
        if (altId && isMovieWatchedLocal(altId)) return true;
      }
      return false;
    },
    () => false,
  );
}

if (typeof window !== "undefined") {
  let lastProfile = activeProfileId();
  const onProfileChange = () => {
    const p = activeProfileId();
    if (p === lastProfile) return;
    lastProfile = p;
    cache = null;
    version += 1;
    for (const fn of subs) fn();
  };
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}
