import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, audioDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, remove } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { startDownload, type DownloadHandle } from "@/lib/download/video-download";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import type { MusicTrack, MusicSourceCandidate } from "./types";

export type MusicDownload = {
  id: string;
  track: MusicTrack;
  status: "downloading" | "done" | "error";
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
let entries: MusicDownload[] = [];
try {
  entries = JSON.parse(readMusicPreference(KEY) || "[]")
    .filter((entry: MusicDownload) => /^[a-f0-9-]{36}$/.test(entry.id) && entry.track?.id)
    .map((entry: MusicDownload) => ({
      ...entry,
      status: entry.status === "done" ? "done" : "error",
    }));
} catch {
  /* Empty first-run library. */
}
function publish() {
  entries = [...entries];
  writeMusicPreference(KEY, JSON.stringify(entries));
  listeners.forEach((listener) => listener());
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
    () => entries,
    () => entries,
  );
export const musicDownloadFor = (track: MusicTrack) =>
  entries.find(
    (entry) => entry.track.id === track.id && entry.track.connectorId === track.connectorId,
  );
export async function musicDownloadPath(id: string) {
  const saved = entries.find((entry) => entry.id === id)?.path;
  if (saved) return saved;
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid download");
  return join(await appDataDir(), "music-downloads", `${id}.audio`);
}
export async function downloadedMusicTrack(entry: MusicDownload): Promise<MusicTrack> {
  const path = await musicDownloadPath(entry.id);
  if (entry.status !== "done" || !(await exists(path))) {
    entry.status = "error";
    entry.error = "music.download.missing";
    publish();
    throw new Error("music.download.missing");
  }
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
  const prior = musicDownloadFor(track);
  if (prior?.status === "downloading" || prior?.status === "done") return;
  if (track.connectorId === "spotify" || track.connectorId === "local")
    throw new Error("music.download.unsupported");
  const id = prior?.id ?? crypto.randomUUID();
  const { playbackUrl: _url, ...metadata } = track;
  const entry: MusicDownload = {
    id,
    track: metadata,
    status: "downloading",
    progress: 0,
    bytes: 0,
    added: Date.now(),
  };
  entries = [...entries.filter((item) => item.id !== id), entry];
  publish();
  const job = (async () => {
    try {
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
      const stream = await invoke<{
        url: string;
        mimeType?: string;
        httpHeaders?: Record<string, string>;
      }>("music_resolve_stream", { track: source });
      if (canceled.has(id)) return;
      if (
        !/^https?:\/\//i.test(stream.url) ||
        /(?:mpegurl|dash\+xml)/i.test(stream.mimeType ?? "") ||
        /\.m3u8(?:[?#]|$)/i.test(stream.url)
      )
        throw new Error("music.download.unsupported");
      const folder = await musicDownloadFolder();
      await mkdir(folder, { recursive: true });
      const path = await freeTarget(
        folder,
        musicFileName(source, audioContainer(stream.mimeType, stream.url)),
      );
      entry.path = path;
      if (canceled.has(id)) return;
      // A freshly resolved URL may use a different rendition; never append to an older one.
      if (await exists(`${path}.part`)) await remove(`${path}.part`);
      if (canceled.has(id)) return;
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
      if (withFilters && !canceled.has(id)) {
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
      if (!canceled.has(id)) {
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
    }
  })();
  jobs.set(id, job);
  await job;
}
export async function deleteMusicDownload(id: string): Promise<void> {
  canceled.add(id);
  handles.get(id)?.abort();
  await jobs.get(id);
  try {
    const path = await musicDownloadPath(id);
    if (await exists(path)) await remove(path);
    if (await exists(`${path}.part`)) await remove(`${path}.part`);
    entries = entries.filter((entry) => entry.id !== id);
    publish();
  } finally {
    canceled.delete(id);
  }
}
export async function revealMusicDownload(id: string) {
  await revealItemInDir(await musicDownloadPath(id));
}
