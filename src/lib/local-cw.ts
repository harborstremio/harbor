const KEY_PREFIX = "harbor.localcw.v1.";
const LEGACY_KEY = "harbor.localcw.v1";
const PROFILES_KEY = "harbor.profiles.v1";
const MAX = 60;
const FINISHED_RATIO = 0.92;

export type LocalCwEntry = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  videoId?: string;
  positionMs: number;
  durationMs: number;
  t: number;
};

const subs = new Set<() => void>();
let version = 0;
let cache: Record<string, LocalCwEntry> | null = null;
let cacheProfile: string | null = null;
let listCache: LocalCwEntry[] | null = null;

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const state = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean }>;
    };
    if (typeof state.activeId === "string" && state.activeId) return state.activeId;
    const primary = state.profiles?.find((profile) => profile?.isPrimary);
    return primary && typeof primary.id === "string" ? primary.id : "";
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const state = raw
      ? (JSON.parse(raw) as {
          profiles?: Array<{ id?: string; isPrimary?: boolean }>;
        })
      : null;
    const primary = state?.profiles?.find((profile) => profile?.isPrimary);
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
    const profileId = primaryProfileId();
    if (!profileId) return;
    const profileKey = KEY_PREFIX + profileId;
    if (!localStorage.getItem(profileKey)) localStorage.setItem(profileKey, legacy);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* noop */
  }
}

function readAll(): Record<string, LocalCwEntry> {
  const profileId = activeProfileId();
  if (cache && cacheProfile === profileId) return cache;
  migrateLegacy();
  let next: Record<string, LocalCwEntry>;
  try {
    const raw = localStorage.getItem(storeKey());
    next = raw ? (JSON.parse(raw) as Record<string, LocalCwEntry>) : {};
  } catch {
    next = {};
  }
  cache = next;
  cacheProfile = profileId;
  listCache = null;
  return next;
}

function writeAll(all: Record<string, LocalCwEntry>): void {
  cache = all;
  cacheProfile = activeProfileId();
  listCache = null;
  try {
    localStorage.setItem(storeKey(), JSON.stringify(all));
  } catch {
    /* noop */
  }
  version += 1;
  for (const fn of subs) fn();
}

export function saveLocalCw(entry: LocalCwEntry): void {
  if (!entry.id || (entry.type !== "movie" && entry.type !== "series")) return;
  const all = { ...readAll() };
  const finished = entry.durationMs > 0 && entry.positionMs / entry.durationMs >= FINISHED_RATIO;
  if (finished && entry.type === "movie") {
    if (!(entry.id in all)) return;
    delete all[entry.id];
  } else {
    all[entry.id] = entry;
    const ids = Object.keys(all);
    if (ids.length > MAX) {
      ids.sort((a, b) => all[a].t - all[b].t);
      for (const id of ids.slice(0, ids.length - MAX)) delete all[id];
    }
  }
  writeAll(all);
}

export function listLocalCw(): LocalCwEntry[] {
  if (listCache) return listCache;
  listCache = Object.values(readAll()).sort((a, b) => b.t - a.t);
  return listCache;
}

export function localCwEntry(id: string): LocalCwEntry | null {
  return readAll()[id] ?? null;
}

export function clearLocalCw(id: string): void {
  const all = readAll();
  if (!(id in all)) return;
  const next = { ...all };
  delete next[id];
  writeAll(next);
}

export function subscribeLocalCw(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function localCwVersion(): number {
  return version;
}

if (typeof window !== "undefined") {
  let lastProfile = activeProfileId();
  const onProfileChange = () => {
    const profileId = activeProfileId();
    if (profileId === lastProfile) return;
    lastProfile = profileId;
    cache = null;
    cacheProfile = null;
    listCache = null;
    version += 1;
    for (const subscriber of subs) subscriber();
  };
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}
