import { useSyncExternalStore } from "react";

let snapVersion = 0;
const snapListeners = new Set<() => void>();

function bumpSnapVersion(): void {
  snapVersion += 1;
  for (const l of snapListeners) l();
}

export function useSnapshotVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      snapListeners.add(cb);
      return () => snapListeners.delete(cb);
    },
    () => snapVersion,
    () => snapVersion,
  );
}

const PREFIX = "harbor.snap.";
const INDEX_KEY = "harbor.snap.index";
const RETENTION_KEY = "harbor.snap.retention";
const MAX_ENTRIES = 80;
const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type IndexEntry = { id: string; t: number };

function readIndex(): IndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as IndexEntry[];
  } catch {
    return [];
  }
}

function writeIndex(entries: IndexEntry[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* noop */
  }
}

function retentionDays(): number {
  try {
    const raw = localStorage.getItem(RETENTION_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
  } catch {
    /* noop */
  }
  return DEFAULT_RETENTION_DAYS;
}

function retentionMs(): number {
  return retentionDays() * DAY_MS;
}

function snapshotsDisabled(): boolean {
  return retentionDays() === 0;
}

function dropEntry(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* noop */
  }
}

function pruneExpired(index: IndexEntry[]): IndexEntry[] {
  const cutoff = Date.now() - retentionMs();
  const kept: IndexEntry[] = [];
  for (const e of index) {
    if (e.t < cutoff) {
      dropEntry(e.id);
    } else {
      kept.push(e);
    }
  }
  return kept;
}

function frameBytes(id: string): number {
  try {
    return localStorage.getItem(PREFIX + id)?.length ?? 0;
  } catch {
    return 0;
  }
}

function enforceByteBudget(index: IndexEntry[]): IndexEntry[] {
  let total = 0;
  for (const e of index) total += frameBytes(e.id);
  while (total > MAX_TOTAL_BYTES && index.length > 1) {
    const evicted = index.shift();
    if (!evicted) break;
    total -= frameBytes(evicted.id);
    dropEntry(evicted.id);
  }
  return index;
}

export function readSnapshot(id: string): string | null {
  if (snapshotsDisabled()) return null;
  const index = readIndex();
  const entry = index.find((e) => e.id === id);
  if (!entry) return tryReadOrphan(id);
  if (Date.now() - entry.t > retentionMs()) {
    dropEntry(id);
    writeIndex(index.filter((e) => e.id !== id));
    return null;
  }
  try {
    return localStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

function tryReadOrphan(id: string): string | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const index = readIndex();
    if (!index.some((e) => e.id === id)) {
      index.push({ id, t: Date.now() });
      writeIndex(index);
    }
    return raw;
  } catch {
    return null;
  }
}

export function saveSnapshot(id: string, dataUrl: string): void {
  if (snapshotsDisabled()) return;
  let index = readIndex().filter((e) => e.id !== id);
  index = pruneExpired(index);
  index.push({ id, t: Date.now() });
  while (index.length > MAX_ENTRIES) {
    const evicted = index.shift();
    if (evicted) dropEntry(evicted.id);
  }
  let saved = false;
  for (let attempts = 0; attempts < 50; attempts++) {
    try {
      localStorage.setItem(PREFIX + id, dataUrl);
      saved = true;
      break;
    } catch {
      const evicted = index.shift();
      if (!evicted || index.every((e) => e.id === id)) break;
      dropEntry(evicted.id);
    }
  }
  if (saved) {
    index = enforceByteBudget(index);
  } else {
    index = index.filter((e) => e.id !== id);
  }
  writeIndex(index);
  if (saved) bumpSnapVersion();
}

export function setSnapshotRetentionDays(days: number): void {
  try {
    if (Number.isFinite(days) && days >= 0) {
      localStorage.setItem(RETENTION_KEY, String(Math.round(days)));
    } else {
      localStorage.removeItem(RETENTION_KEY);
    }
  } catch {
    /* noop */
  }
  if (snapshotsDisabled()) {
    clearAllSnapshots();
  } else {
    pruneExpiredSnapshots();
  }
}

export function pruneExpiredSnapshots(): void {
  const pruned = pruneExpired(readIndex());
  writeIndex(pruned);
}

export function clearAllSnapshots(): number {
  const index = readIndex();
  for (const e of index) dropEntry(e.id);
  writeIndex([]);
  try {
    const orphans: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== INDEX_KEY && k !== RETENTION_KEY) orphans.push(k);
    }
    for (const k of orphans) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* noop */
      }
    }
    return index.length + orphans.length;
  } catch {
    return index.length;
  }
}

export function snapshotCount(): number {
  return readIndex().length;
}

export function getSnapshotRetentionDays(): number {
  try {
    const raw = localStorage.getItem(RETENTION_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  } catch {
    /* noop */
  }
  return DEFAULT_RETENTION_DAYS;
}

const THUMB_WIDTH = 320;
const THUMB_QUALITY = 0.65;
const FULL_WIDTH = 1280;
const FULL_QUALITY = 0.9;

export function captureFrame(video: HTMLVideoElement, fullQuality = false): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  try {
    const canvas = document.createElement("canvas");
    const targetW = fullQuality ? Math.min(FULL_WIDTH, video.videoWidth) : THUMB_WIDTH;
    const scale = targetW / video.videoWidth;
    canvas.width = targetW;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", fullQuality ? FULL_QUALITY : THUMB_QUALITY);
  } catch {
    return null;
  }
}

export async function captureMpvFrame(fullQuality = false): Promise<string | null> {
  const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const fullDataUrl = await invoke<string>("mpv_screenshot_data_url");
    if (!fullDataUrl) return null;
    return await downscaleDataUrl(
      fullDataUrl,
      fullQuality ? FULL_WIDTH : THUMB_WIDTH,
      fullQuality ? FULL_QUALITY : THUMB_QUALITY,
    );
  } catch (e) {
    console.warn("[snapshots] mpv frame capture failed", e);
    return null;
  }
}

async function downscaleDataUrl(dataUrl: string, targetW: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        const w = Math.min(targetW, img.naturalWidth);
        const scale = w / img.naturalWidth;
        canvas.width = w;
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
