import { useEffect, useSyncExternalStore } from "react";
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
}

export function externalCwConnected(): boolean {
  return (sourceMask.simkl && !!getSimklSession()) || (sourceMask.trakt && !!getTraktSession());
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

let sourceMask = { trakt: true, simkl: true };

export function setExternalCwSources(mask: { trakt: boolean; simkl: boolean }): void {
  if (mask.trakt === sourceMask.trakt && mask.simkl === sourceMask.simkl) return;
  sourceMask = { trakt: mask.trakt, simkl: mask.simkl };
  fetchedAt = 0;
  // Drop items from newly-disabled sources synchronously so their cards vanish
  // immediately instead of lingering until the next successful refresh.
  if (items.length > 0) {
    const kept = items.filter(
      (i) => (mask.trakt || i.external !== "trakt") && (mask.simkl || i.external !== "simkl"),
    );
    if (kept.length !== items.length) setItems(kept);
  }
  if (!externalCwConnected()) setItems(EMPTY);
  void refreshExternalCw(true);
}

async function runRefresh(): Promise<boolean> {
  const enabled: Array<() => Promise<LibraryItem[]>> = [];
  if (getSimklSession() && sourceMask.simkl) enabled.push(fetchSimklPlaybackItems);
  if (getTraktSession() && sourceMask.trakt) enabled.push(fetchTraktPlaybackItems);
  const results = await Promise.all(
    enabled.map(async (fetch) => {
      try {
        return await fetch();
      } catch {
        return null;
      }
    }),
  );
  const succeeded = results.filter((r): r is LibraryItem[] => r !== null);
  if (succeeded.length === 0) return false;
  retryAttempt = 0;
  fetchedAt = Date.now();
  setItems(merge(succeeded));
  return true;
}

function cancelRetry(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}

// After a total failure, retry at 1s/4s/10s so a cold start with a dead network
// self-heals once connectivity returns instead of caching the failure for STALE_MS.
function scheduleRetry(): void {
  if (retryTimer !== null) return;
  if (retryAttempt >= RETRY_DELAYS_MS.length) return;
  const gen = refreshGen;
  const delay = RETRY_DELAYS_MS[retryAttempt];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void (async () => {
      const ok = await runRefresh();
      // A newer refresh supersedes this retry; let it own the outcome.
      if (gen !== refreshGen) return;
      if (!ok) scheduleRetry();
    })();
  }, delay);
}

export function refreshExternalCw(force = false): Promise<void> {
  refreshGen += 1;
  cancelRetry();
  if (!externalCwConnected()) {
    fetchedAt = 0;
    setItems(EMPTY);
    return Promise.resolve();
  }
  if (inflight) return force ? inflight.then(() => refreshExternalCw(true)) : inflight;
  if (!force && fetchedAt > 0 && Date.now() - fetchedAt < STALE_MS) return Promise.resolve();
  inflight = (async () => {
    const ok = await runRefresh();
    if (!ok) scheduleRetry();
  })().finally(() => {
    inflight = null;
  });
  return inflight;
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

function connSignature(): string {
  const sm = sourceMask.simkl && getSimklSession() ? "s" : "-";
  const tm = sourceMask.trakt && getTraktSession() ? "t" : "-";
  return `${sm}${tm}`;
}

let lastConn = "";

function onSessionChange(): void {
  const sig = connSignature();
  if (sig === lastConn) return;
  lastConn = sig;
  fetchedAt = 0;
  if (!externalCwConnected()) setItems(EMPTY);
  void refreshExternalCw(true);
}

function onProfileChange(): void {
  lastConn = "";
  fetchedAt = 0;
  setItems(EMPTY);
  void refreshExternalCw(true);
}

if (typeof window !== "undefined") {
  subscribeSimklSession(onSessionChange);
  subscribeTraktSession(onSessionChange);
  window.addEventListener("harbor:active-profile-changed", onProfileChange);
  window.addEventListener("harbor:profiles-updated", onProfileChange);
}

export function useExternalCw(enabled = true): LibraryItem[] {
  const snapshot = useSyncExternalStore(subscribeExternalCw, listExternalCw, listExternalCw);
  useEffect(() => {
    if (!enabled) return;
    lastConn = connSignature();
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
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return enabled ? snapshot : EMPTY;
}
