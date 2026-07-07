import { downloadDir as systemDownloadDir } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { buildDefaultFilename } from "./filename";
import { startDownload, type DownloadHandle } from "./video-download";

export type DownloadItem = {
  id: string;
  metaId: string;
  title: string;
  subtitle: string | null;
  poster: string | null;
  season: number | null;
  episode: number | null;
  streamLabel: string | null;
  url: string;
  path: string;
  status: "downloading" | "paused" | "done" | "error" | "canceled" | "interrupted";
  receivedBytes: number;
  totalBytes: number | null;
  ratio: number;
  bytesPerSec: number;
  error: string | null;
  startedAt: number;
};

type EnqueueArgs = {
  meta: Meta;
  episode?: PlayEpisode;
  streamLabel?: string | null;
  url: string;
};

const items = new Map<string, DownloadItem>();
const handles = new Map<string, DownloadHandle>();
const speed = new Map<string, { bytes: number; at: number }>();
const listeners = new Set<() => void>();

let snapshot: DownloadItem[] = [];

const PERSIST_KEY = "harbor.downloads.v1";

function persist() {
  try {
    const durable = [...items.values()].map((d) => ({ ...d, bytesPerSec: 0 }));
    localStorage.setItem(PERSIST_KEY, JSON.stringify(durable));
  } catch {
    /* ignore */
  }
}

function rebuild() {
  snapshot = [...items.values()].sort((a, b) => b.startedAt - a.startedAt);
  persist();
  listeners.forEach((l) => l());
}

function hydrate() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as DownloadItem[];
    if (!Array.isArray(arr)) return;
    for (const d of arr) {
      if (!d || typeof d.id !== "string" || typeof d.path !== "string") continue;
      const status = d.status === "downloading" ? "interrupted" : d.status;
      items.set(d.id, { ...d, status, bytesPerSec: 0 });
    }
    snapshot = [...items.values()].sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    /* ignore */
  }
}

hydrate();

function patch(id: string, next: Partial<DownloadItem>) {
  const cur = items.get(id);
  if (!cur) return;
  items.set(id, { ...cur, ...next });
  rebuild();
}

function sep(): string {
  return navigator.platform.toLowerCase().includes("win") ? "\\" : "/";
}

async function resolveDir(): Promise<string> {
  try {
    const raw = localStorage.getItem("harbor.settings");
    const fromSettings = raw ? (JSON.parse(raw) as { downloadDir?: string }).downloadDir?.trim() : "";
    if (fromSettings) return fromSettings;
  } catch {
    /* fall through to system default */
  }
  return (await systemDownloadDir().catch(() => "")) || "";
}

async function pathTaken(path: string): Promise<boolean> {
  for (const d of items.values()) if (d.path === path) return true;
  try {
    return await exists(path);
  } catch {
    return false;
  }
}

async function uniquePath(path: string): Promise<string> {
  if (!(await pathTaken(path))) return path;
  const s = sep();
  const slash = path.lastIndexOf(s);
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : "";
  for (let i = 2; i < 1000; i++) {
    const candidate = `${dir}${stem} (${i})${ext}`;
    if (!(await pathTaken(candidate))) return candidate;
  }
  return path;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`;
}

export function activeDownloadFor(
  metaId: string,
  season?: number | null,
  episode?: number | null,
): DownloadItem | null {
  for (const d of items.values()) {
    if (d.metaId !== metaId) continue;
    if (season != null && episode != null) {
      if (d.season !== season || d.episode !== episode) continue;
    } else if (d.season != null || d.episode != null) {
      continue;
    }
    return d;
  }
  return null;
}

export async function enqueueDownload(args: EnqueueArgs): Promise<string> {
  const { meta, episode, streamLabel, url } = args;
  const dir = await resolveDir();
  const filename = buildDefaultFilename(meta, episode, url, streamLabel);
  const path = await uniquePath(
    dir ? `${dir}${dir.endsWith(sep()) ? "" : sep()}${filename}` : filename,
  );
  const id = randomId();
  const item: DownloadItem = {
    id,
    metaId: meta.id,
    title: meta.name ?? "Download",
    subtitle: episode
      ? `S${episode.imdbSeason ?? episode.season} · E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}${episode.name ? ` · ${episode.name}` : ""}`
      : (meta.releaseInfo ?? null),
    poster: meta.poster ?? null,
    season: episode?.season ?? null,
    episode: episode?.episode ?? null,
    streamLabel: streamLabel ?? null,
    url,
    path,
    status: "downloading",
    receivedBytes: 0,
    totalBytes: null,
    ratio: 0,
    bytesPerSec: 0,
    error: null,
    startedAt: Date.now(),
  };
  items.set(id, item);
  speed.set(id, { bytes: 0, at: Date.now() });
  rebuild();

  const handle = startDownload(id, url, path, (p) => {
    const now = Date.now();
    const s = speed.get(id);
    let bps = 0;
    if (s && now - s.at >= 500) {
      bps = ((p.receivedBytes - s.bytes) / (now - s.at)) * 1000;
      speed.set(id, { bytes: p.receivedBytes, at: now });
    }
    patch(id, {
      receivedBytes: p.receivedBytes,
      totalBytes: p.totalBytes,
      ratio: p.ratio,
      ...(bps > 0 ? { bytesPerSec: bps } : {}),
    });
  });
  handles.set(id, handle);
  handle.promise
    .then(() => patch(id, { status: "done", ratio: 1, bytesPerSec: 0 }))
    .catch((e: unknown) => {
      if (e instanceof Error && e.name === "AbortError") {
        const cur = items.get(id);
        if (cur?.status === "paused") return;
        patch(id, { status: "canceled", bytesPerSec: 0 });
        return;
      }
      patch(id, { status: "error", error: e instanceof Error ? e.message : "Download failed", bytesPerSec: 0 });
    })
    .finally(() => {
      handles.delete(id);
      speed.delete(id);
    });
  return id;
}

export function cancelDownload(id: string): void {
  const h = handles.get(id);
  if (h) {
    h.abort();
    return;
  }
  const cur = items.get(id);
  if (cur?.status === "paused") {
    patch(id, { status: "canceled", bytesPerSec: 0 });
  }
}

export function pauseDownload(id: string): void {
  const h = handles.get(id);
  if (!h) return;
  patch(id, { status: "paused" });
  h.abort();
}

export function resumeDownload(id: string): void {
  const cur = items.get(id);
  if (!cur || cur.status !== "paused" || handles.has(id)) return;
  patch(id, { status: "downloading", error: null, receivedBytes: 0, ratio: 0, bytesPerSec: 0 });
  const handle = startDownload(id, cur.url, cur.path, (p) => {
    const now = Date.now();
    const s = speed.get(id);
    let bps = 0;
    if (s && now - s.at >= 500) {
      bps = ((p.receivedBytes - s.bytes) / (now - s.at)) * 1000;
      speed.set(id, { bytes: p.receivedBytes, at: now });
    }
    patch(id, {
      receivedBytes: p.receivedBytes,
      totalBytes: p.totalBytes,
      ratio: p.ratio,
      ...(bps > 0 ? { bytesPerSec: bps } : {}),
    });
  });
  handles.set(id, handle);
  handle.promise
    .then(() => patch(id, { status: "done", ratio: 1, bytesPerSec: 0 }))
    .catch((e: unknown) => {
      if (e instanceof Error && e.name === "AbortError") {
        const cur = items.get(id);
        if (cur?.status === "paused") return;
        patch(id, { status: "canceled", bytesPerSec: 0 });
        return;
      }
      patch(id, { status: "error", error: e instanceof Error ? e.message : "Download failed", bytesPerSec: 0 });
    })
    .finally(() => {
      handles.delete(id);
      speed.delete(id);
    });
}

export function removeDownload(id: string): void {
  const item = items.get(id);
  handles.get(id)?.abort();
  handles.delete(id);
  speed.delete(id);
  if (items.delete(id)) rebuild();
  if (item) {
    void remove(item.path).catch(() => {});
    void remove(`${item.path}.part`).catch(() => {});
  }
}

export async function revealDownload(id: string): Promise<void> {
  const d = items.get(id);
  if (!d) return;
  try {
    await revealItemInDir(d.path);
  } catch {
    /* opener unavailable */
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDownloads(): DownloadItem[] {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function useActiveDownloadCount(): number {
  const all = useDownloads();
  return all.filter((d) => d.status === "downloading").length;
}
