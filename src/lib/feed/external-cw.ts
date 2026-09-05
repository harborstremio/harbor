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
import type { LibraryItem } from "@/lib/stremio";

const STALE_MS = 300_000;
const EMPTY: LibraryItem[] = [];

let items: LibraryItem[] = EMPTY;
let fetchedAt = 0;
let inflight: Promise<void> | null = null;
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

function merge(lists: LibraryItem[][]): LibraryItem[] {
  const byId = new Map<string, LibraryItem>();
  for (const list of lists) {
    for (const i of list) {
      const held = byId.get(i._id);
      if (!held || activityOf(i) > activityOf(held)) byId.set(i._id, i);
    }
  }
  return [...byId.values()].sort((a, b) => activityOf(b) - activityOf(a));
}

let sourceMask = { trakt: true, simkl: true };

export function setExternalCwSources(mask: { trakt: boolean; simkl: boolean }): void {
  if (mask.trakt === sourceMask.trakt && mask.simkl === sourceMask.simkl) return;
  sourceMask = { trakt: mask.trakt, simkl: mask.simkl };
  fetchedAt = 0;
  if (!externalCwConnected()) setItems(EMPTY);
  void refreshExternalCw(true);
}

export function refreshExternalCw(force = false): Promise<void> {
  if (!externalCwConnected()) {
    fetchedAt = 0;
    setItems(EMPTY);
    return Promise.resolve();
  }
  if (inflight) return force ? inflight.then(() => refreshExternalCw(true)) : inflight;
  if (!force && fetchedAt > 0 && Date.now() - fetchedAt < STALE_MS) return Promise.resolve();
  inflight = (async () => {
    const [simkl, trakt] = await Promise.all([
      getSimklSession() && sourceMask.simkl
        ? fetchSimklPlaybackItems().catch(() => EMPTY)
        : Promise.resolve(EMPTY),
      getTraktSession() && sourceMask.trakt
        ? fetchTraktPlaybackItems().catch(() => EMPTY)
        : Promise.resolve(EMPTY),
    ]);
    fetchedAt = Date.now();
    setItems(merge([simkl, trakt]));
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
  }, [enabled]);
  return enabled ? snapshot : EMPTY;
}
