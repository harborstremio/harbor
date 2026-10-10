import { useEffect, useSyncExternalStore } from "react";
import { detectAnimeForCw } from "@/lib/anime-detect";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import { fetchTraktPlaybackItems } from "@/lib/trakt/playback";
import {
  getSession as getSimklSession,
  subscribeSession as subscribeSimklSession,
} from "@/lib/simkl/session";
import {
  getSession as getTraktSession,
  subscribeSession as subscribeTraktSession,
} from "@/lib/trakt/session";
import { fetchPublicMetaDbPlaybackItems } from "@/lib/publicmetadb/playback";
import {
  getSession as getPmdbSession,
  subscribeSession as subscribePmdbSession,
} from "@/lib/publicmetadb/session";
import { episodeFromVideoId, type LibraryItem } from "@/lib/stremio";

const STALE_MS = 300_000;
const FOCUS_STALE_MS = 30_000;
const RETRY_DELAYS_MS = [1000, 4000, 10000];
const EMPTY: LibraryItem[] = [];

let items: LibraryItem[] = EMPTY;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let refreshGen = 0;
const subs = new Set<() => void>();

function emit(): void {
  for (const fn of subs) fn();
}

function setItems(next: LibraryItem[]): void {
  if (next.length === 0 && items.length === 0) return;
  items = next;
  emit();
  void detectAnimeForCw(next.filter((item) => !item.isAnime));
}

export function externalCwConnected(): boolean {
  return (
    (sourceMask.simkl && !!getSimklSession()) ||
    (sourceMask.trakt && !!getTraktSession()) ||
    (sourceMask.publicmetadb && !!getPmdbSession())
  );
}

function activityOf(i: LibraryItem): number {
  const lw = Date.parse(i.state?.lastWatched ?? "");
  if (Number.isFinite(lw)) return lw;
  const m = Date.parse(i._mtime ?? "");
  return Number.isFinite(m) ? m : 0;
}

function mergeKey(i: LibraryItem): string {
  const se = episodeFromVideoId(i.state?.video_id);
  const season = i.state?.season ?? se?.season;
  const episode = i.state?.episode ?? se?.episode;
  return `${i._id}|${season ?? ""}|${episode ?? ""}`;
}

function merge(lists: LibraryItem[][]): LibraryItem[] {
  const byKey = new Map<string, LibraryItem>();
  for (const list of lists) {
    for (const i of list) {
      const key = mergeKey(i);
      const held = byKey.get(key);
      if (!held || activityOf(i) > activityOf(held)) byKey.set(key, i);
    }
  }
  return [...byKey.values()].sort((a, b) => activityOf(b) - activityOf(a));
}

let sourceMask = { trakt: true, simkl: true, publicmetadb: false };

export function setExternalCwSources(mask: {
  trakt: boolean;
  simkl: boolean;
  publicmetadb?: boolean;
}): void {
  const pm = mask.publicmetadb ?? sourceMask.publicmetadb;
  if (
    mask.trakt === sourceMask.trakt &&
    mask.simkl === sourceMask.simkl &&
    pm === sourceMask.publicmetadb
  )
    return;
  sourceMask = { trakt: mask.trakt, simkl: mask.simkl, publicmetadb: pm };
  fetchedAt = 0;
  // Drop items from newly-disabled sources synchronously so their cards vanish
  // immediately instead of lingering until the next successful refresh.
  if (items.length > 0) {
    const kept = items.filter(
      (i) =>
        (sourceMask.trakt || i.external !== "trakt") &&
        (sourceMask.simkl || i.external !== "simkl") &&
        (sourceMask.publicmetadb || i.external !== "publicmetadb"),
    );
    if (kept.length !== items.length) setItems(kept);
  }
  if (!externalCwConnected()) setItems(EMPTY);
  void refreshExternalCw(true);
}

async function runRefresh(gen: number): Promise<boolean> {
  const enabled: Array<{
    source: "simkl" | "trakt" | "publicmetadb";
    fetch: () => Promise<LibraryItem[]>;
  }> = [];
  if (getSimklSession() && sourceMask.simkl)
    enabled.push({ source: "simkl", fetch: fetchSimklPlaybackItems });
  if (getTraktSession() && sourceMask.trakt)
    enabled.push({ source: "trakt", fetch: fetchTraktPlaybackItems });
  if (getPmdbSession() && sourceMask.publicmetadb)
    enabled.push({ source: "publicmetadb", fetch: fetchPublicMetaDbPlaybackItems });
  const results = await Promise.all(
    enabled.map(async ({ fetch }) => {
      try {
        return await fetch();
      } catch {
        return null;
      }
    }),
  );
  // A disabled source or superseded request must not publish its late response.
  if (gen !== refreshGen) return true;
  const complete = results.every((r) => r !== null);
  fetchedAt = complete ? Date.now() : 0;
  const succeeded = results.filter((r): r is LibraryItem[] => r !== null);
  if (succeeded.length === 0) return false;
  const failedSources = new Set(
    enabled.filter((_, index) => results[index] === null).map(({ source }) => source),
  );
  const retained = items.filter((i) => i.external && failedSources.has(i.external));
  setItems(merge([...succeeded, retained]));
  if (complete) retryAttempt = 0;
  return complete;
}

function cancelRetry(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

// Retry failed trackers at 1s/4s/10s, including partial failures, so cold-start
// progress can arrive without toggling settings or dropping previously loaded cards.
function scheduleRetry(): void {
  if (retryTimer !== null) return;
  if (retryAttempt >= RETRY_DELAYS_MS.length) return;
  const gen = refreshGen;
  const delay = RETRY_DELAYS_MS[retryAttempt];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (gen === refreshGen) void startRefresh(gen);
  }, delay);
}

function startRefresh(gen: number): Promise<void> {
  inflight = runRefresh(gen)
    .then((ok) => {
      if (gen === refreshGen && !ok) scheduleRetry();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshExternalCw(force = false): Promise<void> {
  if (!externalCwConnected()) {
    refreshGen += 1;
    cancelRetry();
    fetchedAt = 0;
    setItems(EMPTY);
    return Promise.resolve();
  }
  if (inflight) {
    if (!force) return inflight;
    refreshGen += 1;
    cancelRetry();
    return inflight.then(() => refreshExternalCw(true));
  }
  if (!force && fetchedAt > 0 && Date.now() - fetchedAt < STALE_MS) return Promise.resolve();
  cancelRetry();
  return startRefresh(++refreshGen);
}

export function listExternalCw(): LibraryItem[] {
  return items;
}

export function subscribeExternalCw(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

let lastSimkl = getSimklSession();
let lastTrakt = getTraktSession();
let lastPmdb = getPmdbSession();

function onSessionChange(): void {
  const simkl = getSimklSession();
  const trakt = getTraktSession();
  const pmdb = getPmdbSession();
  if (simkl === lastSimkl && trakt === lastTrakt && pmdb === lastPmdb) return;
  setItems(
    items.filter(
      (i) =>
        (i.external !== "simkl" || simkl === lastSimkl) &&
        (i.external !== "trakt" || trakt === lastTrakt) &&
        (i.external !== "publicmetadb" || pmdb === lastPmdb),
    ),
  );
  lastSimkl = simkl;
  lastTrakt = trakt;
  lastPmdb = pmdb;
  fetchedAt = 0;
  if (!externalCwConnected()) setItems(EMPTY);
  void refreshExternalCw(true);
}

function onProfileChange(): void {
  lastSimkl = getSimklSession();
  lastTrakt = getTraktSession();
  lastPmdb = getPmdbSession();
  fetchedAt = 0;
  setItems(EMPTY);
  void refreshExternalCw(true);
}

if (typeof window !== "undefined") {
  subscribeSimklSession(onSessionChange);
  subscribeTraktSession(onSessionChange);
  subscribePmdbSession(onSessionChange);
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}

export function useExternalCw(enabled = true): LibraryItem[] {
  const snapshot = useSyncExternalStore(subscribeExternalCw, listExternalCw, listExternalCw);
  useEffect(() => {
    if (!enabled) return;
    onSessionChange();
    void refreshExternalCw();
    const onFocus = (): void => {
      if (Date.now() - fetchedAt > FOCUS_STALE_MS) void refreshExternalCw(true);
      else void refreshExternalCw();
    };
    const onVisible = (): void => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - fetchedAt > FOCUS_STALE_MS) void refreshExternalCw(true);
      else void refreshExternalCw();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, STALE_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [enabled]);
  return enabled ? snapshot : EMPTY;
}
