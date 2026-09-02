import { downloadDir as systemDownloadDir } from "@tauri-apps/api/path";
import { exists, mkdir, remove } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { buildDefaultFilename, sanitizeName } from "./filename";
import { startDownload, type DownloadHandle } from "./video-download";
import { isWindowsDesktop } from "@/lib/platform";
import {
  localEngineStreamRef,
  pauseTorrentUsage,
  releaseTorrentUsage,
  retainTorrentUsage,
  torrentEnginePause,
  torrentEngineSelectSet,
} from "@/lib/torrent/local-engine";

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
  torrentInfoHash?: string | null;
  torrentFileIdx?: number | null;
  path: string;
  status: "downloading" | "paused" | "done" | "error" | "canceled" | "interrupted";
  receivedBytes: number;
  totalBytes: number | null;
  ratio: number;
  bytesPerSec: number;
  error: string | null;
  startedAt: number;
  kind?: "video" | "ebook";
  format?: "epub" | "pdf";
  author?: string | null;
  publishedYear?: number | null;
  summary?: string | null;
  phaseLabel?: string | null;
  etaSeconds?: number | null;
  canPause?: boolean;
};

export type ManagedDownloadProgress = {
  receivedBytes: number;
  totalBytes: number | null;
  ratio: number;
  bytesPerSec: number;
  etaSeconds?: number | null;
  label?: string | null;
};

type ManagedDownloadRunner = (
  signal: AbortSignal,
  onProgress: (progress: ManagedDownloadProgress) => void,
) => Promise<void>;

export type ManagedDownloadArgs = {
  metaId: string;
  title: string;
  subtitle?: string | null;
  poster?: string | null;
  path: string;
  format: "epub" | "pdf";
  author?: string | null;
  publishedYear?: number | null;
  summary?: string | null;
  run: ManagedDownloadRunner;
};

type EnqueueArgs = {
  meta: Meta;
  episode?: PlayEpisode;
  streamLabel?: string | null;
  url: string;
  headers?: Record<string, string> | null;
  destinationPath?: string | null;
};

const items = new Map<string, DownloadItem>();
const handles = new Map<string, DownloadHandle>();
const completions = new Map<string, Promise<void>>();
const requestHeaders = new Map<string, Record<string, string>>();
const speed = new Map<string, { bytes: number; at: number }>();
const managedControllers = new Map<string, AbortController>();
const managedRunners = new Map<string, ManagedDownloadRunner>();
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
      const status = d.status === "downloading" || d.status === "paused" ? "interrupted" : d.status;
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
  return isWindowsDesktop() ? "\\" : "/";
}

async function resolveDir(): Promise<string> {
  try {
    const raw = localStorage.getItem("harbor.settings");
    const fromSettings = raw
      ? (JSON.parse(raw) as { downloadDir?: string }).downloadDir?.trim()
      : "";
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

// P2P engine downloads read from a shared torrent via /stream/<hash>/<idx>.
// Keep that torrent selecting exactly the files that still have an active
// download; when none are left, pause it so it stops pulling the rest of a pack.
function reconcileEngineSelection(hash: string): void {
  const wanted = new Set<number>();
  for (const d of items.values()) {
    if (d.status !== "downloading") continue;
    const ref = localEngineStreamRef(d.url);
    if (ref && ref.infoHash.toLowerCase() === hash) wanted.add(ref.fileIdx);
  }
  if (wanted.size === 0) void torrentEnginePause(hash);
  else void torrentEngineSelectSet(hash, [...wanted]);
}

function reconcileFromUrl(url: string): void {
  const ref = localEngineStreamRef(url);
  if (ref) reconcileEngineSelection(ref.infoHash.toLowerCase());
}

function torrentOwnerId(id: string): string {
  return `download:${id}`;
}

function retainDownloadTorrent(item: DownloadItem): void {
  const engine = downloadTorrentRef(item);
  if (engine) retainTorrentUsage(engine.infoHash, torrentOwnerId(item.id));
}

function releaseDownloadTorrent(item: DownloadItem): void {
  const engine = downloadTorrentRef(item);
  if (!engine) return;
  // The destination file is now authoritative. Remove the temporary engine
  // copy once no player or other intentional download is still using it.
  releaseTorrentUsage(engine.infoHash, torrentOwnerId(item.id), { deleteFiles: true });
}

function downloadTorrentRef(item: DownloadItem) {
  if (item.torrentInfoHash && item.torrentFileIdx != null) {
    return { infoHash: item.torrentInfoHash.toLowerCase(), fileIdx: item.torrentFileIdx };
  }
  return localEngineStreamRef(item.url);
}

export async function completedTorrentDownloadFor(
  infoHash: string,
  fileIdx?: number,
  hint?: { season?: number | null; episode?: number | null },
): Promise<DownloadItem | null> {
  const key = infoHash.trim().toLowerCase();
  const candidates = [...items.values()]
    .filter((item) => {
      if (item.status !== "done") return false;
      const ref = downloadTorrentRef(item);
      return ref?.infoHash === key && (fileIdx == null || ref.fileIdx === fileIdx);
    })
    .sort((a, b) => b.startedAt - a.startedAt);
  const episodeMatch =
    hint?.season != null && hint.episode != null
      ? candidates.find((item) => item.season === hint.season && item.episode === hint.episode)
      : null;
  const match =
    fileIdx != null
      ? (candidates[0] ?? null)
      : hint?.season != null && hint.episode != null
        ? (episodeMatch ?? null)
        : candidates.length === 1
          ? candidates[0]
          : null;
  if (!match) return null;
  return (await exists(match.path).catch(() => false)) ? match : null;
}

export async function completedDownloadFor(
  metaId: string,
  season: number | null,
  episode: number | null,
): Promise<DownloadItem | null> {
  const candidates = [...items.values()]
    .filter((d) => {
      if (d.status !== "done" || d.metaId !== metaId) return false;
      if (season == null && episode == null) return d.season == null && d.episode == null;
      return d.season === season && d.episode === episode;
    })
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const item of candidates) {
    if (await exists(item.path).catch(() => false)) return item;
  }
  return null;
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
  const { meta, episode, streamLabel, url, headers, destinationPath } = args;
  const existing = [...items.values()].find(
    (item) =>
      item.metaId === meta.id &&
      item.url === url &&
      item.season === (episode?.season ?? null) &&
      item.episode === (episode?.episode ?? null) &&
      (item.status === "downloading" || item.status === "paused"),
  );
  if (existing) return existing.id;
  const torrentRef = localEngineStreamRef(url);
  let dir = "";
  if (!destinationPath) {
    dir = await resolveDir();
    try {
      const raw = localStorage.getItem("harbor.settings");
      const settings = raw ? (JSON.parse(raw) as { downloadCreateFolders?: boolean }) : null;
      if (settings?.downloadCreateFolders && dir) {
        const folderName = sanitizeName(meta.name || "download");
        dir = `${dir}${dir.endsWith(sep()) ? "" : sep()}${folderName}`;
        await mkdir(dir, { recursive: true }).catch(() => {});
      }
    } catch {}
  }
  const filename = buildDefaultFilename(meta, episode, url, streamLabel);
  const path =
    destinationPath ??
    (await uniquePath(dir ? `${dir}${dir.endsWith(sep()) ? "" : sep()}${filename}` : filename));
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
    torrentInfoHash: torrentRef?.infoHash ?? null,
    torrentFileIdx: torrentRef?.fileIdx ?? null,
    path,
    status: "downloading",
    receivedBytes: 0,
    totalBytes: null,
    ratio: 0,
    bytesPerSec: 0,
    error: null,
    startedAt: Date.now(),
    kind: "video",
    canPause: true,
  };
  items.set(id, item);
  if (headers && Object.keys(headers).length > 0) requestHeaders.set(id, headers);
  rebuild();

  beginDownload(id);
  return id;
}

export function enqueueManagedDownload(args: ManagedDownloadArgs): string {
  const existing = [...items.values()].find(
    (item) =>
      item.kind === "ebook" &&
      item.metaId === args.metaId &&
      item.format === args.format &&
      (item.status === "downloading" || item.status === "paused"),
  );
  if (existing) return existing.id;
  const id = randomId();
  items.set(id, {
    id,
    metaId: args.metaId,
    title: args.title,
    subtitle: args.subtitle ?? null,
    poster: args.poster ?? null,
    season: null,
    episode: null,
    streamLabel: args.format.toUpperCase(),
    url: `harbor-ebook://${encodeURIComponent(args.metaId)}/${args.format}`,
    path: args.path,
    status: "downloading",
    receivedBytes: 0,
    totalBytes: null,
    ratio: 0,
    bytesPerSec: 0,
    error: null,
    startedAt: Date.now(),
    kind: "ebook",
    format: args.format,
    author: args.author ?? null,
    publishedYear: args.publishedYear ?? null,
    summary: args.summary ?? null,
    phaseLabel: "Queued",
    etaSeconds: null,
    canPause: false,
  });
  managedRunners.set(id, args.run);
  rebuild();
  beginManagedDownload(id);
  return id;
}

function beginManagedDownload(id: string): void {
  const item = items.get(id);
  const run = managedRunners.get(id);
  if (!item || !run || managedControllers.has(id)) return;
  const controller = new AbortController();
  managedControllers.set(id, controller);
  const completion = run(controller.signal, (progress) => {
    if (items.get(id)?.status !== "downloading") return;
    patch(id, {
      receivedBytes: progress.receivedBytes,
      totalBytes: progress.totalBytes,
      ratio: Math.max(0, Math.min(1, progress.ratio)),
      bytesPerSec: progress.bytesPerSec,
      etaSeconds: progress.etaSeconds ?? null,
      phaseLabel: progress.label ?? null,
    });
  })
    .then(() => {
      if (items.get(id)?.status === "downloading")
        patch(id, {
          status: "done",
          ratio: 1,
          bytesPerSec: 0,
          etaSeconds: 0,
          phaseLabel: item.format === "pdf" ? "Print dialog opened" : "Saved",
        });
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") {
        if (items.get(id)?.status === "downloading")
          patch(id, { status: "canceled", bytesPerSec: 0, etaSeconds: null });
        return;
      }
      if (items.get(id)?.status === "canceled") return;
      patch(id, {
        status: "error",
        error: error instanceof Error ? error.message : "Download failed",
        bytesPerSec: 0,
        etaSeconds: null,
      });
    })
    .finally(() => {
      managedControllers.delete(id);
      managedRunners.delete(id);
      if (completions.get(id) === completion) completions.delete(id);
    });
  completions.set(id, completion);
}

function beginDownload(id: string): void {
  const item = items.get(id);
  if (!item || handles.has(id)) return;
  retainDownloadTorrent(item);
  speed.set(id, { bytes: item.receivedBytes, at: Date.now() });
  const handle = startDownload(
    id,
    item.url,
    item.path,
    (p) => {
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
    },
    requestHeaders.get(id),
  );
  handles.set(id, handle);
  const completion = handle.promise
    .then(() => patch(id, { status: "done", ratio: 1, bytesPerSec: 0 }))
    .catch((e: unknown) => {
      if (e instanceof Error && e.name === "AbortError") {
        if (items.get(id)?.status === "paused") return;
        patch(id, { status: "canceled", bytesPerSec: 0 });
        return;
      }
      patch(id, {
        status: "error",
        error: e instanceof Error ? e.message : "Download failed",
        bytesPerSec: 0,
      });
    })
    .finally(() => {
      if (handles.get(id) === handle) handles.delete(id);
      if (completions.get(id) === completion) completions.delete(id);
      speed.delete(id);
      const current = items.get(id);
      if (current?.status !== "paused") {
        requestHeaders.delete(id);
        if (current) releaseDownloadTorrent(current);
      }
      reconcileFromUrl(item.url);
    });
  completions.set(id, completion);
}

export function cancelDownload(id: string): void {
  const item = items.get(id);
  if (!item || (item.status !== "downloading" && item.status !== "paused")) return;
  const wasPaused = item.status === "paused";
  patch(id, { status: "canceled", bytesPerSec: 0 });
  managedControllers.get(id)?.abort();
  requestHeaders.delete(id);
  handles.get(id)?.abort();
  if (wasPaused) releaseDownloadTorrent(item);
  reconcileFromUrl(item.url);
}

export function pauseDownload(id: string): void {
  const item = items.get(id);
  const handle = handles.get(id);
  if (!item || item.canPause === false || item.status !== "downloading" || !handle) return;
  patch(id, { status: "paused", bytesPerSec: 0 });
  handle.abort();
  const engine = downloadTorrentRef(item);
  if (engine) pauseTorrentUsage(engine.infoHash, torrentOwnerId(id));
}

export async function resumeDownload(id: string): Promise<void> {
  if (items.get(id)?.status !== "paused") return;
  await completions.get(id);
  if (items.get(id)?.status !== "paused" || handles.has(id)) return;
  patch(id, { status: "downloading", error: null, bytesPerSec: 0 });
  beginDownload(id);
  const url = items.get(id)?.url;
  if (url) reconcileFromUrl(url);
}

export function removeDownload(id: string): void {
  const item = items.get(id);
  handles.get(id)?.abort();
  handles.delete(id);
  completions.delete(id);
  requestHeaders.delete(id);
  speed.delete(id);
  managedControllers.get(id)?.abort();
  managedControllers.delete(id);
  managedRunners.delete(id);
  if (items.delete(id)) rebuild();
  if (item) {
    releaseDownloadTorrent(item);
    reconcileFromUrl(item.url);
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

export function subscribeDownloads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function downloadsSnapshot(): DownloadItem[] {
  return snapshot;
}

export function useDownloads(): DownloadItem[] {
  return useSyncExternalStore(
    subscribeDownloads,
    () => snapshot,
    () => snapshot,
  );
}

export function useActiveDownloadCount(): number {
  const all = useDownloads();
  return all.filter((d) => d.status === "downloading" || d.status === "paused").length;
}
