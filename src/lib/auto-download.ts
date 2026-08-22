import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";

export type AutoDlStop =
  | { kind: "off" }
  | { kind: "seasonEnd" }
  | { kind: "count"; value: number; from?: number };

export type AutoDlSeries = {
  id: string;
  title: string;
  poster?: string;
  type: string;
  addedAt: number;
  allowP2p: boolean;
  maxHeight: number | null;
  stop: AutoDlStop;
  lastCheckedAt: number | null;
  lastGrabbed: string | null;
  grabbedCount: number;
  grabbedKeys: string[];
  nextAirDate: number | null;
  addonBase?: string;
  addonType?: string;
};

const KEY = "harbor.auto-download.v1";

let items: AutoDlSeries[] = load();
const listeners = new Set<() => void>();

function normalize(e: Partial<AutoDlSeries> & { id: string }): AutoDlSeries {
  const stop: AutoDlStop =
    e.stop && typeof e.stop === "object" && typeof (e.stop as AutoDlStop).kind === "string"
      ? (e.stop as AutoDlStop)
      : { kind: "off" };
  return {
    id: e.id,
    title: typeof e.title === "string" ? e.title : "",
    poster: typeof e.poster === "string" ? e.poster : undefined,
    type: typeof e.type === "string" ? e.type : "series",
    addedAt: typeof e.addedAt === "number" ? e.addedAt : Date.now(),
    allowP2p: e.allowP2p === true,
    maxHeight: typeof e.maxHeight === "number" ? e.maxHeight : null,
    stop,
    lastCheckedAt: typeof e.lastCheckedAt === "number" ? e.lastCheckedAt : null,
    lastGrabbed: typeof e.lastGrabbed === "string" ? e.lastGrabbed : null,
    grabbedCount: typeof e.grabbedCount === "number" ? e.grabbedCount : 0,
    grabbedKeys: Array.isArray(e.grabbedKeys)
      ? e.grabbedKeys.filter((k) => typeof k === "string")
      : [],
    nextAirDate: typeof e.nextAirDate === "number" ? e.nextAirDate : null,
    addonBase: typeof e.addonBase === "string" ? e.addonBase : undefined,
    addonType: typeof e.addonType === "string" ? e.addonType : undefined,
  };
}

function load(): AutoDlSeries[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.id === "string").map(normalize);
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  listeners.forEach((l) => l());
}

export function autoDlList(): AutoDlSeries[] {
  return items;
}

export function isAutoDownloaded(id: string): boolean {
  return items.some((i) => i.id === id);
}

export function addAutoDownload(meta: Meta): AutoDlSeries {
  const existing = items.find((i) => i.id === meta.id);
  if (existing) return existing;
  const entry: AutoDlSeries = {
    id: meta.id,
    title: meta.name,
    poster: meta.poster,
    type: meta.type,
    addedAt: Date.now(),
    allowP2p: false,
    maxHeight: null,
    stop: { kind: "off" },
    lastCheckedAt: null,
    lastGrabbed: null,
    grabbedCount: 0,
    grabbedKeys: [],
    nextAirDate: null,
    addonBase: meta.addonOrigin?.base,
    addonType: meta.type,
  };
  items = [entry, ...items];
  persist();
  return entry;
}

export function recordGrab(id: string, key: string, grabbedLabel: string): void {
  items = items.map((i) => {
    if (i.id !== id || i.grabbedKeys.includes(key)) return i;
    return {
      ...i,
      grabbedKeys: [...i.grabbedKeys, key],
      grabbedCount: i.grabbedCount + 1,
      lastGrabbed: grabbedLabel,
    };
  });
  persist();
}

export function removeAutoDownload(id: string): void {
  items = items.filter((i) => i.id !== id);
  persist();
}

export function updateAutoDownload(id: string, patch: Partial<AutoDlSeries>): void {
  items = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  persist();
}

export function toggleAutoDownload(meta: Meta): boolean {
  if (isAutoDownloaded(meta.id)) {
    removeAutoDownload(meta.id);
    return false;
  }
  addAutoDownload(meta);
  return true;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useAutoDownload(): AutoDlSeries[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}

export function useIsAutoDownloaded(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isAutoDownloaded(id),
    () => isAutoDownloaded(id),
  );
}
