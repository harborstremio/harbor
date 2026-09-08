import { invoke } from "@tauri-apps/api/core";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
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
  /** Headers stay in memory; this flag prevents an incomplete restart after relaunch. */
  requiresHeaders?: boolean;
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
const removing = new Set<string>();
const sessionSources = new Set<string>();
const listeners = new Set<() => void>();

let snapshot: DownloadItem[] = [];

const PERSIST_KEY = "harbor.downloads.v1";

function writeItems(next: DownloadItem[]) {
  const durable = next.map((d) => ({ ...d, bytesPerSec: 0 }));
  localStorage.setItem(PERSIST_KEY, JSON.stringify(durable));
}

function persist() {
  try {
    writeItems([...items.values()]);
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
  if (await invoke<boolean>("is_context_review")) return invoke<string>("harbor_download_dir");
  try {
    const raw = localStorage.getItem("harbor.settings");
    const fromSettings = raw
      ? (JSON.parse(raw) as { downloadDir?: string }).downloadDir?.trim()
      : "";
    if (fromSettings) return fromSettings;
  } catch {
    /* fall through to system default */
  }
  return invoke<string>("harbor_download_dir");
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
    requiresHeaders: !!headers && Object.keys(headers).length > 0,
  };
  items.set(id, item);
  sessionSources.add(id);
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
        if (current?.status === "done") {
          requestHeaders.delete(id);
          sessionSources.delete(id);
        }
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
  handles.get(id)?.abort();
  if (wasPaused) releaseDownloadTorrent(item);
  reconcileFromUrl(item.url);
}

export function pauseDownload(id: string): void {
  const item = items.get(id);
  const handle = handles.get(id);
  if (
    !item ||
    removing.has(id) ||
    item.canPause === false ||
    item.status !== "downloading" ||
    !handle
  )
    return;
  patch(id, { status: "paused", bytesPerSec: 0 });
  handle.abort();
  const engine = downloadTorrentRef(item);
  if (engine) pauseTorrentUsage(engine.infoHash, torrentOwnerId(id));
}

export async function resumeDownload(id: string): Promise<void> {
  if (removing.has(id) || items.get(id)?.status !== "paused") return;
  await completions.get(id);
  if (removing.has(id) || items.get(id)?.status !== "paused" || handles.has(id)) return;
  patch(id, { status: "downloading", error: null, bytesPerSec: 0 });
  beginDownload(id);
  const url = items.get(id)?.url;
  if (url) reconcileFromUrl(url);
}

export function downloadById(id: string): DownloadItem | null {
  return items.get(id) ?? null;
}

function isPrintReceipt(item: DownloadItem): boolean {
  return item.kind === "ebook" && item.format === "pdf";
}

function retrySourceAvailable(item: DownloadItem): boolean {
  if (item.kind === "ebook" || downloadTorrentRef(item)) return false;
  if (!/^https?:\/\//i.test(item.url)) return false;
  return sessionSources.has(item.id) || item.requiresHeaders === false;
}

export function downloadCapabilities(id: string) {
  const item = items.get(id);
  if (!item) return null;
  const busy = removing.has(id);
  const file = item.status === "done" && !isPrintReceipt(item);
  return {
    busy,
    play: !busy && file && item.kind !== "ebook",
    reveal: !busy && file,
    pause: !busy && item.status === "downloading" && item.canPause !== false && handles.has(id),
    resume: !busy && item.status === "paused" && item.kind !== "ebook",
    cancel: !busy && (item.status === "downloading" || item.status === "paused"),
    retry:
      !busy &&
      ["error", "interrupted", "canceled"].includes(item.status) &&
      retrySourceAvailable(item),
    delete: !busy,
    printReceipt: isPrintReceipt(item),
  };
}

export async function retryDownload(id: string): Promise<void> {
  if (!downloadCapabilities(id)?.retry)
    throw new Error("Choose a download source again to retry this item.");
  await completions.get(id);
  if (!downloadCapabilities(id)?.retry || handles.has(id))
    throw new Error("This download has changed. Try again.");
  patch(id, { status: "downloading", error: null, bytesPerSec: 0 });
  beginDownload(id);
}

type DownloadFileInfo = { exists: boolean; isFile: boolean; canonicalPath: string | null };

async function inspectFile(path: string): Promise<DownloadFileInfo> {
  if (!path.trim()) throw new Error("This download has no file path.");
  return invoke<DownloadFileInfo>("download_file_info", { path });
}

export async function completedDownloadById(id: string): Promise<DownloadItem> {
  const item = items.get(id);
  if (!item || item.status !== "done" || removing.has(id))
    throw new Error("This download is no longer available.");
  if (isPrintReceipt(item))
    throw new Error("This item opened a PDF print dialog; Harbor has no saved file to open.");
  const file = await inspectFile(item.path);
  if (!file.exists) throw new Error("The downloaded file is missing or no longer exists.");
  if (!file.isFile) throw new Error("The download path is not a regular file.");
  const current = items.get(id);
  if (!current || current.path !== item.path || current.status !== "done" || removing.has(id))
    throw new Error("This download has changed. Try again.");
  return current;
}

export type DownloadDeleteOptions = { protectedPaths?: () => string[] };

function filePaths(item: DownloadItem): string[] {
  if (isPrintReceipt(item)) return [];
  return item.kind === "ebook" ? [item.path] : [item.path, `${item.path}.part`];
}

function pathKey(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return isWindowsDesktop() ? normalized.toLowerCase() : normalized;
}

async function checkFileOwnership(id: string, paths: string[], protectedPaths: string[]) {
  const targets = await Promise.all(
    paths.map(async (path) => ({ path, info: await inspectFile(path) })),
  );
  for (const target of targets) {
    if (target.info.exists && !target.info.isFile)
      throw new Error("The download path is not a regular file; folders cannot be deleted here.");
  }
  const otherPaths = [...items.values()].filter((d) => d.id !== id).flatMap(filePaths);
  const protectedFiles = await Promise.all(
    [...otherPaths, ...protectedPaths].map(async (path) => ({
      path,
      info: await inspectFile(path),
    })),
  );
  for (const target of targets) {
    for (const other of protectedFiles) {
      const samePath = pathKey(target.path) === pathKey(other.path);
      const sameFile =
        target.info.canonicalPath &&
        other.info.canonicalPath &&
        pathKey(target.info.canonicalPath) === pathKey(other.info.canonicalPath);
      if (samePath || sameFile)
        throw new Error("This file is shared with another download or is in use by the player.");
    }
  }
  return targets;
}

export async function removeDownload(
  id: string,
  options: DownloadDeleteOptions = {},
): Promise<void> {
  if (removing.has(id)) throw new Error("This download is already being deleted.");
  const item = items.get(id);
  if (!item) throw new Error("This download no longer exists.");
  removing.add(id);
  rebuild();
  try {
    cancelDownload(id);
    // The completion includes native command settlement, after its writer is closed.
    await completions.get(id);
    const current = items.get(id);
    if (!current || current.path !== item.path)
      throw new Error("This download has changed. Try again.");
    const paths = filePaths(current);
    const targets = await checkFileOwnership(id, paths, options.protectedPaths?.() ?? []);
    let deletedFiles = 0;
    for (const target of targets) {
      if (!target.info.exists) continue;
      await invoke("download_delete_file", {
        path: target.path,
        expectedCanonicalPath: target.info.canonicalPath,
        protectedPaths: [...items.values()]
          .filter((d) => d.id !== id)
          .flatMap(filePaths)
          .concat(options.protectedPaths?.() ?? []),
      });
      deletedFiles++;
    }
    try {
      // Keep the row and its retry state until its removal is durably acknowledged.
      // A file deletion cannot be rolled back when browser storage is unavailable.
      writeItems([...items.values()].filter((download) => download.id !== id));
    } catch (cause) {
      const message =
        deletedFiles > 0
          ? "Files were deleted, but the download record could not be removed. Retry removal."
          : "The download record could not be removed. Retry removal.";
      items.set(id, { ...current, status: "error", error: message, bytesPerSec: 0 });
      throw new Error(message, { cause });
    }
    requestHeaders.delete(id);
    sessionSources.delete(id);
    speed.delete(id);
    managedRunners.delete(id);
    items.delete(id);
    releaseDownloadTorrent(current);
    reconcileFromUrl(current.url);
  } finally {
    removing.delete(id);
    rebuild();
  }
}

export async function revealDownload(id: string): Promise<void> {
  const item = await completedDownloadById(id);
  await revealItemInDir(item.path);
}

export type DownloadBatchAction = "pause" | "resume" | "cancel" | "retry" | "delete";
export type DownloadBatchResult = {
  succeeded: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
};

export async function runDownloadBatch(
  ids: string[],
  action: DownloadBatchAction,
  options: DownloadDeleteOptions = {},
): Promise<DownloadBatchResult> {
  const result: DownloadBatchResult = { succeeded: [], skipped: [], failed: [] };
  for (const id of new Set(ids)) {
    if (!downloadCapabilities(id)?.[action]) {
      result.skipped.push(id);
      continue;
    }
    try {
      if (action === "delete") await removeDownload(id, options);
      else if (action === "retry") await retryDownload(id);
      else if (action === "resume") await resumeDownload(id);
      else {
        if (action === "pause") pauseDownload(id);
        else cancelDownload(id);
        await completions.get(id);
        const expected = action === "pause" ? "paused" : "canceled";
        if (items.get(id)?.status !== expected)
          throw new Error("The download finished or failed before this action completed.");
      }
      result.succeeded.push(id);
    } catch (error) {
      result.failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
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
