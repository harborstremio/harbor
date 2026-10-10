import { convertFileSrc } from "@tauri-apps/api/core";
import { BaseDirectory, mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { readLocalJson, writeLocalJson } from "./local-store";

const INDEX = "playlist-covers";
const DIR = "music-store/covers";
const MAX_EDGE = 900;
const MAX_INPUT_BYTES = 24 * 1024 * 1024;
const QUALITY = 0.9;
const ACCEPTED = /^image\/(png|jpeg|webp|gif|avif)$/;
const EVENT = "harbor:music-playlist-cover";
const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type CoverIndex = Record<string, { file: string; at: number }>;

let index: CoverIndex = {};
let loaded = false;
const resolved = new Map<string, string>();

export function musicPlaylistCoverEvent(): string {
  return EVENT;
}

function announce(playlistId: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: playlistId }));
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  index = (await readLocalJson<CoverIndex>(INDEX)) ?? {};
}

async function appDataPath(file: string): Promise<string> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appDataDir(), file);
}

export function cachedPlaylistCover(playlistId: string): string | undefined {
  return resolved.get(playlistId);
}

export async function readPlaylistCover(playlistId: string): Promise<string> {
  const held = resolved.get(playlistId);
  if (held !== undefined) return held;
  await load();
  const entry = index[playlistId];
  if (!entry || !IS_TAURI) {
    resolved.set(playlistId, "");
    return "";
  }
  try {
    const url = `${convertFileSrc(await appDataPath(entry.file))}?v=${entry.at}`;
    resolved.set(playlistId, url);
    return url;
  } catch {
    resolved.set(playlistId, "");
    return "";
  }
}

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("music.playlist.coverFailed");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) =>
    canvas.toBlob(done, "image/webp", QUALITY),
  );
  if (!blob) throw new Error("music.playlist.coverFailed");
  return blob;
}

export async function savePlaylistCover(playlistId: string, file: File): Promise<string> {
  if (!ACCEPTED.test(file.type)) throw new Error("music.playlist.coverType");
  if (file.size > MAX_INPUT_BYTES) throw new Error("music.playlist.coverSize");
  if (!IS_TAURI) throw new Error("music.playlist.coverFailed");
  await load();
  const blob = await shrink(file);
  const safe = playlistId.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60);
  const target = `${DIR}/${safe}.webp`;
  await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true }).catch(() => {});
  await writeFile(target, new Uint8Array(await blob.arrayBuffer()), {
    baseDir: BaseDirectory.AppData,
  });
  index = { ...index, [playlistId]: { file: target, at: Date.now() } };
  writeLocalJson(INDEX, index);
  resolved.delete(playlistId);
  const url = await readPlaylistCover(playlistId);
  announce(playlistId);
  return url;
}

export async function clearPlaylistCover(playlistId: string): Promise<void> {
  await load();
  const entry = index[playlistId];
  if (entry && IS_TAURI) {
    await remove(entry.file, { baseDir: BaseDirectory.AppData }).catch(() => {});
  }
  const next = { ...index };
  delete next[playlistId];
  index = next;
  writeLocalJson(INDEX, index);
  resolved.set(playlistId, "");
  announce(playlistId);
}
