import type { LibraryItem } from "@/lib/stremio";
import { persistCritical } from "@/lib/storage-recovery";

const KEY = "harbor.manualwatched.v1";
const UNKEY = "harbor.manualunwatched.v1";
const METAKEY = "harbor.manualwatched.meta.v1";
const DISMISSKEY = "harbor.manualwatched.dismissed.v1";
const UNWATCHED_AT_KEY = "harbor.manualunwatched.at.v1";
const REMOTE_KEY = "harbor.manualwatched.fromremote.v1";

export type ManualWatchedMeta = {
  type: "series";
  name: string;
  poster?: string;
  background?: string;
  markedAt?: string;
};

const subs = new Set<() => void>();
let version = 0;
let watchedCache: Set<string> | null = null;
let unwatchedCache: Set<string> | null = null;
let metaCache: Record<string, ManualWatchedMeta> | null = null;
let dismissedCache: Set<string> | null = null;
let unwatchedAtCache: Record<string, number> | null = null;
let remoteCache: Set<string> | null = null;

function unwatchedAtMap(): Record<string, number> {
  if (!unwatchedAtCache) {
    try {
      const raw = JSON.parse(localStorage.getItem(UNWATCHED_AT_KEY) ?? "{}");
      unwatchedAtCache = raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
    } catch {
      unwatchedAtCache = {};
    }
  }
  return unwatchedAtCache;
}

function remoteSet(): Set<string> {
  if (!remoteCache) remoteCache = loadSet(REMOTE_KEY);
  return remoteCache;
}

function persistUnwatchedAt(): void {
  persistCritical(UNWATCHED_AT_KEY, JSON.stringify(unwatchedAtCache ?? {}));
}

function persistRemote(): void {
  persistCritical(REMOTE_KEY, JSON.stringify([...(remoteCache ?? [])]));
}

function loadMeta(): Record<string, ManualWatchedMeta> {
  if (metaCache) return metaCache;
  try {
    const raw = localStorage.getItem(METAKEY);
    const parsed = raw ? JSON.parse(raw) : {};
    metaCache =
      parsed && typeof parsed === "object" ? (parsed as Record<string, ManualWatchedMeta>) : {};
  } catch {
    metaCache = {};
  }
  return metaCache;
}

function dismissedSet(): Set<string> {
  if (!dismissedCache) dismissedCache = loadSet(DISMISSKEY);
  return dismissedCache;
}

function undismiss(metaId: string): void {
  const set = dismissedSet();
  if (!set.has(metaId)) return;
  const next = new Set(set);
  next.delete(metaId);
  dismissedCache = next;
  try {
    localStorage.setItem(DISMISSKEY, JSON.stringify([...next]));
  } catch {
    return;
  }
  version += 1;
  for (const fn of subs) fn();
}

export function dismissManualWatched(metaId: string): void {
  const set = dismissedSet();
  if (set.has(metaId)) return;
  const next = new Set(set);
  next.add(metaId);
  dismissedCache = next;
  try {
    localStorage.setItem(DISMISSKEY, JSON.stringify([...next]));
  } catch {
    return;
  }
  version += 1;
  for (const fn of subs) fn();
}

function loadSet(storageKey: string): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function watchedSet(): Set<string> {
  if (!watchedCache) watchedCache = loadSet(KEY);
  return watchedCache;
}

function unwatchedSet(): Set<string> {
  if (!unwatchedCache) unwatchedCache = loadSet(UNKEY);
  return unwatchedCache;
}

function persist(on: Set<string>, off: Set<string>): void {
  watchedCache = on;
  unwatchedCache = off;
  persistCritical(KEY, JSON.stringify([...on]));
  persistCritical(UNKEY, JSON.stringify([...off]));
  version += 1;
  for (const fn of subs) fn();
}

function key(metaId: string, season: number, episode: number): string {
  return `${metaId}|${season}|${episode}`;
}

export function isManuallyWatched(metaId: string, season: number, episode: number): boolean {
  return watchedSet().has(key(metaId, season, episode));
}

export function manualWatchedState(
  metaId: string,
  season: number,
  episode: number,
): boolean | undefined {
  const k = key(metaId, season, episode);
  if (watchedSet().has(k)) return true;
  if (unwatchedSet().has(k)) return false;
  return undefined;
}

export function manualEpisodeKeys(metaId: string): {
  watched: Set<string>;
  unwatched: Set<string>;
} {
  const prefix = `${metaId}|`;
  const collect = (src: Set<string>): Set<string> => {
    const out = new Set<string>();
    for (const k of src) {
      if (!k.startsWith(prefix)) continue;
      const parts = k.split("|");
      if (parts.length === 3) out.add(`${parts[1]}:${parts[2]}`);
    }
    return out;
  };
  return { watched: collect(watchedSet()), unwatched: collect(unwatchedSet()) };
}

export function setManualWatched(
  metaId: string,
  season: number,
  episode: number,
  watched: boolean,
): void {
  const on = new Set(watchedSet());
  const off = new Set(unwatchedSet());
  const k = key(metaId, season, episode);
  const at = unwatchedAtMap();
  const rem = remoteSet();
  if (watched) {
    on.add(k);
    off.delete(k);
    delete at[k];
  } else {
    on.delete(k);
    off.add(k);
    at[k] = Date.now();
  }
  if (rem.delete(k)) persistRemote();
  persistUnwatchedAt();
  persist(on, off);
}

export function setManualWatchedUpTo(
  metaId: string,
  season: number,
  episode: number,
  watched: boolean,
): void {
  const on = new Set(watchedSet());
  const off = new Set(unwatchedSet());
  const at = unwatchedAtMap();
  const rem = remoteSet();
  const now = Date.now();
  let remChanged = false;
  for (let e = 1; e <= episode; e++) {
    const k = key(metaId, season, e);
    if (watched) {
      on.add(k);
      off.delete(k);
      delete at[k];
    } else {
      on.delete(k);
      off.add(k);
      at[k] = now;
    }
    if (rem.delete(k)) remChanged = true;
  }
  if (remChanged) persistRemote();
  persistUnwatchedAt();
  persist(on, off);
}

export function setManualWatchedMany(
  metaId: string,
  episodes: Array<{ season: number; episode: number }>,
  watched: boolean,
): void {
  const on = new Set(watchedSet());
  const off = new Set(unwatchedSet());
  const at = unwatchedAtMap();
  const rem = remoteSet();
  const now = Date.now();
  let remChanged = false;
  for (const { season, episode } of episodes) {
    const k = key(metaId, season, episode);
    if (watched) {
      on.add(k);
      off.delete(k);
      delete at[k];
    } else {
      on.delete(k);
      off.add(k);
      at[k] = now;
    }
    if (rem.delete(k)) remChanged = true;
  }
  if (remChanged) persistRemote();
  persistUnwatchedAt();
  persist(on, off);
}

export function unwatchedAt(metaId: string, season: number, episode: number): number | undefined {
  return unwatchedAtMap()[key(metaId, season, episode)];
}

export function remoteWatchedKeys(metaId: string): Set<string> {
  const prefix = `${metaId}|`;
  const out = new Set<string>();
  for (const k of remoteSet()) {
    if (!k.startsWith(prefix)) continue;
    const parts = k.split("|");
    if (parts.length === 3) out.add(`${parts[1]}:${parts[2]}`);
  }
  return out;
}

export function applyRemoteWatched(
  metaId: string,
  add: Array<{ season: number; episode: number }>,
  unset: Array<{ season: number; episode: number }>,
): void {
  if (add.length === 0 && unset.length === 0) return;
  const on = new Set(watchedSet());
  const off = new Set(unwatchedSet());
  const at = unwatchedAtMap();
  const rem = remoteSet();
  for (const { season, episode } of add) {
    const k = key(metaId, season, episode);
    on.add(k);
    off.delete(k);
    delete at[k];
    rem.add(k);
  }
  for (const { season, episode } of unset) {
    const k = key(metaId, season, episode);
    on.delete(k);
    off.delete(k);
    delete at[k];
    rem.delete(k);
  }
  persistUnwatchedAt();
  persistRemote();
  persist(on, off);
}

export function recordManualWatchedMeta(metaId: string, meta: ManualWatchedMeta): void {
  const all = loadMeta();
  const prev = all[metaId];
  undismiss(metaId);
  const entry: ManualWatchedMeta = { ...meta, markedAt: new Date().toISOString() };
  const next = { ...all, [metaId]: entry };
  metaCache = next;
  try {
    localStorage.setItem(METAKEY, JSON.stringify(next));
  } catch {
    return;
  }
  if (
    prev &&
    prev.name === meta.name &&
    prev.poster === meta.poster &&
    prev.background === meta.background
  ) {
    return;
  }
  version += 1;
  for (const fn of subs) fn();
}

export function manualWatchedLibraryItems(): LibraryItem[] {
  const meta = loadMeta();
  const best = new Map<string, { season: number; episode: number }>();
  for (const k of watchedSet()) {
    const parts = k.split("|");
    if (parts.length !== 3) continue;
    const [metaId, s, e] = parts;
    const season = Number(s);
    const episode = Number(e);
    if (!metaId || !Number.isFinite(season) || !Number.isFinite(episode)) continue;
    const cur = best.get(metaId);
    if (!cur || season > cur.season || (season === cur.season && episode > cur.episode)) {
      best.set(metaId, { season, episode });
    }
  }
  const out: LibraryItem[] = [];
  const dismissed = dismissedSet();
  const now = new Date().toISOString();
  for (const [metaId, ep] of best) {
    const m = meta[metaId];
    if (!m || dismissed.has(metaId)) continue;
    const stamp = m.markedAt ?? now;
    out.push({
      _id: metaId,
      type: "series",
      name: m.name,
      poster: m.poster,
      background: m.background,
      state: {
        timeOffset: 0,
        duration: 0,
        season: ep.season,
        episode: ep.episode,
        video_id: `${metaId}:${ep.season}:${ep.episode}`,
        flaggedWatched: 1,
        lastWatched: stamp,
      },
      removed: false,
      temp: false,
      _ctime: stamp,
      _mtime: stamp,
      manualWatched: true,
    });
  }
  return out;
}

export function subscribeManualWatched(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function manualWatchedVersion(): number {
  return version;
}
