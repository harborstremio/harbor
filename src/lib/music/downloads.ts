import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, audioDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, remove } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { startDownload, type DownloadHandle } from "@/lib/download/video-download";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import type { MusicTrack, MusicSourceCandidate } from "./types";
import { downloadOwner, subscribeDownloadOwner } from "@/lib/download/owner";
import { directDownloadError, recoveredDownloadStatus, visibleDownloads, type OfflineStatus } from "@/lib/download/offline-policy";

export type MusicDownload = {
  id: string;
  owner?: string;
  withFilters?: boolean;
  track: MusicTrack;
  status: OfflineStatus;
  progress: number;
  bytes: number;
  error?: string;
  added: number;
  path?: string;
};

const CONTAINERS: Array<[RegExp, string]> = [
  [/audio\/(?:mp4|m4a|aac|x-m4a)|^video\/mp4/i, "m4a"],
  [/audio\/(?:mpeg|mp3)/i, "mp3"],
  [/audio\/opus/i, "opus"],
  [/audio\/(?:ogg|vorbis)/i, "ogg"],
  [/audio\/webm|^video\/webm/i, "webm"],
  [/audio\/(?:flac|x-flac)/i, "flac"],
  [/audio\/(?:wav|wave|x-wav)/i, "wav"],
];

export function audioContainer(mimeType: string | undefined, url: string): string {
  for (const [pattern, extension] of CONTAINERS) {
    if (pattern.test(mimeType ?? "")) return extension;
  }
  const fromPath = /\.(m4a|mp3|opus|ogg|webm|flac|wav|aac)(?:[?#]|$)/i.exec(url);
  if (fromPath) return fromPath[1].toLowerCase();
  const fromQuery = /mime=audio(?:%2F|\/)(mp4|webm|mpeg|ogg)/i.exec(url);
  if (fromQuery) {
    const kind = fromQuery[1].toLowerCase();
    return kind === "mp4" ? "m4a" : kind === "mpeg" ? "mp3" : kind;
  }
  return "m4a";
}

function safePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

export function musicFileName(track: MusicTrack, extension: string): string {
  const artist = safePart(track.artist ?? "");
  const title = safePart(track.title ?? "") || "Track";
  const base = (artist ? `${artist} - ${title}` : title).slice(0, 120).trim() || "Track";
  return `${base}.${extension}`;
}

export function musicDownloadDir(): string {
  return (readMusicPreference(DIR_KEY) || "").trim();
}

export function setMusicDownloadDir(dir: string): void {
  writeMusicPreference(DIR_KEY, dir.trim());
  for (const listener of listeners) listener();
}

export async function musicDownloadFolder(): Promise<string> {
  const chosen = musicDownloadDir();
  if (chosen) return chosen;
  try {
    return await join(await audioDir(), "Harbor");
  } catch {
    return join(await appDataDir(), "music-downloads");
  }
}

async function freeTarget(folder: string, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = await join(folder, attempt === 0 ? name : `${stem} (${attempt + 1})${extension}`);
    if (!(await exists(candidate))) return candidate;
  }
  return join(folder, `${stem} ${Date.now()}${extension}`);
}
const KEY = "harbor.music.downloads.v1";
export const DIR_KEY = "harbor.music.download-dir.v1";
const listeners = new Set<() => void>();
const handles = new Map<string, DownloadHandle>();
const jobs = new Map<string, Promise<void>>();
const canceled = new Set<string>();
const running = new Set<string>();
const waiting = new Map<string, (ready: boolean) => void>();
let entries: MusicDownload[] = [];
let snapshot: MusicDownload[] = [];
let owner = downloadOwner();
try {
  entries = JSON.parse(readMusicPreference(KEY) || "[]")
    .filter((entry: MusicDownload) => /^[a-f0-9-]{36}$/.test(entry.id) && entry.track?.id)
    .map((entry: MusicDownload) => ({
      ...entry,
      status: recoveredDownloadStatus(entry.status),
    }));
} catch {
  /* Empty first-run library. */
}
snapshot = visibleDownloads(entries, owner);
function publish() {
  entries = [...entries];
  snapshot = visibleDownloads(entries, downloadOwner());
  writeMusicPreference(KEY, JSON.stringify(entries));
  listeners.forEach((listener) => listener());
}
function owns(entry: MusicDownload | undefined): entry is MusicDownload {
  return !!entry && entry.owner === downloadOwner();
}
function drainQueue() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  for (const [id, ready] of waiting) {
    if (running.size >= 2) break;
    waiting.delete(id);
    const entry = entries.find((item) => item.id === id);
    if (!owns(entry) || entry.status !== "queued") { ready(false); continue; }
    running.add(id); ready(true);
  }
}
subscribeDownloadOwner(() => {
  if (owner === downloadOwner()) return;
  for (const entry of entries) {
    if (entry.owner !== owner || !["downloading", "queued"].includes(entry.status)) continue;
    entry.status = "paused";
    handles.get(entry.id)?.abort();
    waiting.get(entry.id)?.(false); waiting.delete(entry.id);
  }
  owner = downloadOwner(); publish();
});
if (typeof window !== "undefined") window.addEventListener("online", drainQueue);
export function claimLegacyMusicDownloads(): void {
  if (JSON.parse(downloadOwner())[0] !== "local") return;
  for (const entry of entries) if (!entry.owner) entry.owner = downloadOwner();
  publish();
}
export function unclaimedMusicDownloadCount(): number { return entries.filter((entry) => !entry.owner).length; }
export function pauseMusicDownload(id: string): void {
  const entry = entries.find((item) => item.id === id);
  if (!owns(entry) || !["downloading", "queued"].includes(entry.status)) return;
  entry.status = "paused";
  handles.get(id)?.abort();
  waiting.get(id)?.(false); waiting.delete(id);
  publish();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useMusicDownloads = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
export const musicDownloadFor = (track: MusicTrack) =>
  entries.find(
    (entry) => owns(entry) && entry.track.id === track.id && entry.track.connectorId === track.connectorId,
  );
export async function musicDownloadPath(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid download");
  const entry = entries.find((entry) => entry.id === id);
  if (!owns(entry)) throw new Error("This download belongs to another profile");
  const saved = entry.path;
  if (saved) return saved;
  return join(await appDataDir(), "music-downloads", `${id}.audio`);
}
export async function downloadedMusicTrack(entry: MusicDownload): Promise<MusicTrack> {
  if (!owns(entry)) throw new Error("This download belongs to another profile");
  const path = await musicDownloadPath(entry.id);
  if (entry.status !== "done" || !(await exists(path))) {
    entry.status = "error";
    entry.error = "music.download.missing";
    publish();
    throw new Error("music.download.missing");
  }
  if (!owns(entry)) throw new Error("Profile changed before playback");
  return {
    ...entry.track,
    id: `download:${entry.id}`,
    connectorId: "local",
    sourceId: path,
    playbackUrl: path,
    mediaKind: "audio",
  };
}
export async function downloadMusic(
  track: MusicTrack,
  withFilters = false,
): Promise<void> {
  const requestedOwner = downloadOwner();
  const prior = musicDownloadFor(track);
  if (prior && ["downloading", "queued", "done"].includes(prior.status)) return;
  if (prior) await jobs.get(prior.id);
  if (requestedOwner !== downloadOwner()) return;
  if (track.connectorId === "spotify" || track.connectorId === "local")
    throw new Error("music.download.unsupported");
  const id = prior?.id ?? crypto.randomUUID();
  const { playbackUrl: _url, ...metadata } = track;
  const entry: MusicDownload = {
    id,
    owner: downloadOwner(),
    withFilters: prior?.withFilters ?? withFilters,
    track: metadata,
    status: "queued",
    progress: prior?.progress ?? 0,
    bytes: prior?.bytes ?? 0,
    path: prior?.path,
    added: Date.now(),
  };
  entries = [...entries.filter((item) => item.id !== id), entry];
  publish();
  const job = (async () => {
    try {
      const ready = await new Promise<boolean>((resolve) => { waiting.set(id, resolve); drainQueue(); });
      if (!ready || !owns(entry) || canceled.has(id)) return;
      entry.status = "downloading"; publish();
      let source = track;
      if (track.connectorId === "catalog") {
        const candidates = await invoke<MusicSourceCandidate[]>("music_source_candidates", {
          track,
        });
        const preferred = readMusicPreference("harbor.music.preferred-source.v1");
        const playable = candidates.filter(
          (candidate) =>
            !["spotify", "catalog"].includes(candidate.connectorId) &&
            candidate.health !== "offline",
        );
        const candidate =
          playable.find((candidate) => candidate.connectorId === preferred) ?? playable[0];
        if (!candidate) throw new Error("music.download.unsupported");
        source = candidate.track;
      }
      if (!owns(entry) || entry.status !== "downloading") return;
      const stream = await invoke<{
        url: string;
        mimeType?: string;
        httpHeaders?: Record<string, string>;
      }>("music_resolve_stream", { track: source });
      if (canceled.has(id) || !owns(entry) || entry.status !== "downloading") return;
      if (
        directDownloadError(stream.url) ||
        /(?:mpegurl|dash\+xml)/i.test(stream.mimeType ?? "") ||
        /\.m3u8(?:[?#]|$)/i.test(stream.url)
      )
        throw new Error("music.download.unsupported");
      const folder = await musicDownloadFolder();
      await mkdir(folder, { recursive: true });
      const path = entry.path ?? await freeTarget(
        folder,
        musicFileName(source, audioContainer(stream.mimeType, stream.url)),
      );
      entry.path = path;
      publish();
      if (canceled.has(id) || !owns(entry) || entry.status !== "downloading") return;
      // Native resume checks the source/header hash, ETag and exact byte range.
      // A fresh signed URL or rendition safely restarts instead of appending.
      const handle = startDownload(
        `music:${id}`,
        stream.url,
        path,
        (progress) => {
          entry.progress = progress.ratio;
          entry.bytes = progress.receivedBytes;
          publish();
        },
        stream.httpHeaders,
        "audio",
      );
      handles.set(id, handle);
      await handle.promise;
      if (entry.withFilters && !canceled.has(id) && owns(entry) && entry.status === "downloading") {
        try {
          await invoke<boolean>("music_export_filtered", { path });
        } catch (error) {
          entry.error = error instanceof Error ? error.message : "music.download.filterFailed";
        }
      }
      if (!canceled.has(id)) {
        entry.status = "done";
        entry.progress = 1;
        publish();
      }
    } catch (error) {
      if (!canceled.has(id) && entry.status !== "paused") {
        entry.status = "error";
        entry.error =
          error instanceof Error && error.message.startsWith("music.download.")
            ? error.message
            : "music.download.failed";
        publish();
      }
    } finally {
      handles.delete(id);
      jobs.delete(id);
      running.delete(id);
      drainQueue();
    }
  })();
  jobs.set(id, job);
  await job;
}
export async function deleteMusicDownload(id: string): Promise<void> {
  if (!owns(entries.find((entry) => entry.id === id))) return;
  canceled.add(id);
  waiting.get(id)?.(false); waiting.delete(id);
  handles.get(id)?.abort();
  await jobs.get(id);
  try {
    const path = await musicDownloadPath(id);
    if (await exists(path)) await remove(path);
    if (await exists(`${path}.part`)) await remove(`${path}.part`);
    if (await exists(`${path}.part.meta.json`)) await remove(`${path}.part.meta.json`);
    entries = entries.filter((entry) => entry.id !== id);
    publish();
  } finally {
    canceled.delete(id);
  }
}
export async function revealMusicDownload(id: string) {
  await revealItemInDir(await musicDownloadPath(id));
}
