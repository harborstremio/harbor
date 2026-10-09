import { cwProfileScope, privateCwProfileId } from "./cw-profile";

const KEY_PREFIX = "harbor.localcw.v1.";
const PRIVATE_PREFIX = "harbor.localcw.private.v1.";
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
  isAnime?: boolean;
  source?: "library" | "local";
  season?: number;
  episode?: number;
  videoId?: string;
  positionMs: number;
  durationMs: number;
  t: number;
};

const subs = new Set<() => void>();
let version = 0;
const cache = new Map<string, Record<string, LocalCwEntry>>();

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || cwProfileScope().sharedId;
  } catch {
    return cwProfileScope().sharedId;
  }
}

function storeKey(privateOnly = false, ownerId?: string): string {
  const scope = cwProfileScope(ownerId);
  if (privateOnly) return PRIVATE_PREFIX + scope.profileId;
  const id = scope.sharedId;
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

function readAll(key: string): Record<string, LocalCwEntry> {
  const cached = cache.get(key);
  if (cached) return cached;
  migrateLegacy();
  let next: Record<string, LocalCwEntry>;
  try {
    const raw = localStorage.getItem(key);
    next = raw ? (JSON.parse(raw) as Record<string, LocalCwEntry>) : {};
  } catch {
    next = {};
  }
  cache.set(key, next);
  return next;
}

function writeAll(key: string, all: Record<string, LocalCwEntry>): void {
  cache.set(key, all);
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    /* noop */
  }
}

function emit(): void {
  version += 1;
  for (const fn of subs) fn();
}

function saveEntry(key: string, entry: LocalCwEntry): void {
  const all = { ...readAll(key) };
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
  writeAll(key, all);
}

// Only an actual playback session may assign ownership. Cloud absorption keeps
// writing the shared store; its history cannot establish who watched a title.
export function saveLocalCw(entry: LocalCwEntry, ownerId?: string, shared = true): void {
  if (!entry.id || (entry.type !== "movie" && entry.type !== "series")) return;
  if (ownerId) saveEntry(storeKey(true, ownerId), entry);
  if (shared) saveEntry(storeKey(false, ownerId), entry);
  emit();
}

export function listLocalCw(privateOnly = !!privateCwProfileId()): LocalCwEntry[] {
  return Object.values(readAll(storeKey(privateOnly))).sort((a, b) => b.t - a.t);
}

export function localCwEntry(
  id: string,
  privateOnly = !!privateCwProfileId(),
  ownerId?: string,
): LocalCwEntry | null {
  return readAll(storeKey(privateOnly, ownerId))[id] ?? null;
}

export function clearLocalCw(id: string, ownerId?: string): void {
  const keys = ownerId
    ? [storeKey(true, ownerId), storeKey(false, ownerId)]
    : [storeKey(!!privateCwProfileId())];
  let changed = false;
  for (const key of keys) {
    const all = readAll(key);
    if (!(id in all)) continue;
    const next = { ...all };
    delete next[id];
    writeAll(key, next);
    changed = true;
  }
  if (changed) emit();
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
  const identity = () => {
    const s = cwProfileScope();
    return `${s.profileId}|${s.sharedId}`;
  };
  let lastProfile = identity();
  const onProfileChange = () => {
    const p = identity();
    if (p === lastProfile) return;
    lastProfile = p;
    cache.clear();
    emit();
  };
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}
