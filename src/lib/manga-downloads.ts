import { useEffect, useState } from "react";
import { chapterPages } from "@/lib/manga/api";

export type MangaDownloadStatus = "idle" | "downloading" | "paused" | "done" | "error";

export type MangaDownloadRec = {
  status: MangaDownloadStatus;
  done: number;
  total: number;
  files: string[];
};

export type MangaDownloadBatchStatus = "idle" | "downloading" | "paused" | "done" | "error";

export type MangaDownloadBatchRec = {
  status: MangaDownloadBatchStatus;
  done: number;
  total: number;
  failed: number;
};

export type MangaDownloadInfo = {
  title?: string;
  cover?: string;
  chapter?: string | null;
};

type MangaDownloadMetaRec = {
  mangaId: string;
  title?: string;
  cover?: string;
  chapter?: string | null;
  at: number;
};

export type MangaDownloadChapterItem = {
  chapterId: string;
  label: string;
  chapterRaw: string | null | undefined;
  pages: number;
  files: string[];
  num: number;
};

export type MangaDownloadGroup = {
  key: string;
  title: string;
  cover?: string;
  chapters: MangaDownloadChapterItem[];
};

const MANIFEST_KEY = "harbor.manga.downloads.v1";
const META_KEY = "harbor.manga.downloads.meta.v1";
const DIR_KEY = "harbor.manga.downloads.dir.v1";
const runtime = new Map<string, MangaDownloadRec>();
const batchRuntime = new Map<string, MangaDownloadBatchRec>();
const listeners = new Set<(changed?: string) => void>();

type BatchControl = {
  paused: boolean;
  currentChapterId?: string;
  waiters: Set<() => void>;
  promise?: Promise<void>;
};

const batchControls = new Map<string, BatchControl>();

function notify(changed?: string): void {
  for (const l of listeners) l(changed);
}

export function subscribeMangaDownloads(cb: (changed?: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function readManifest(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(MANIFEST_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeManifest(m: Record<string, string[]>): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
  } catch {
    return;
  }
}

function readMeta(): Record<string, MangaDownloadMetaRec> {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeMeta(m: Record<string, MangaDownloadMetaRec>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    return;
  }
}

export function getMangaDownloadDir(): string {
  try {
    return localStorage.getItem(DIR_KEY) || "";
  } catch {
    return "";
  }
}

export function setMangaDownloadDir(dir: string): void {
  try {
    if (dir) localStorage.setItem(DIR_KEY, dir);
    else localStorage.removeItem(DIR_KEY);
  } catch {
    return;
  }
  notify();
}

export async function defaultMangaDownloadDir(): Promise<string> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  return join(await appDataDir(), "manga-downloads");
}

export function useMangaDownloadDir(): string {
  const [dir, setDir] = useState(getMangaDownloadDir);
  useEffect(() => subscribeMangaDownloads(() => setDir(getMangaDownloadDir())), []);
  return dir;
}

function prettySlug(s: string): string {
  return s.replace(/_+/g, " ").trim() || "Manga";
}

export function listMangaDownloadGroups(): MangaDownloadGroup[] {
  const manifest = readManifest();
  const meta = readMeta();
  const groups = new Map<string, MangaDownloadGroup>();
  for (const [chapterId, files] of Object.entries(manifest)) {
    if (!files?.length) continue;
    const m = meta[chapterId];
    const parts = files[0].split(/[\\/]/).filter(Boolean);
    const mangaSlug = parts.length >= 3 ? parts[parts.length - 3] : "manga";
    const chapterSlug = parts.length >= 2 ? parts[parts.length - 2] : chapterId;
    const key = m?.mangaId ?? mangaSlug;
    const label = m
      ? m.chapter == null
        ? "Oneshot"
        : `Chapter ${m.chapter}`
      : prettySlug(chapterSlug);
    const num = m?.chapter != null ? parseFloat(m.chapter) : NaN;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: m?.title || prettySlug(mangaSlug), cover: m?.cover, chapters: [] };
      groups.set(key, group);
    }
    if (!group.cover && m?.cover) group.cover = m.cover;
    if (m?.title && group.title === prettySlug(mangaSlug)) group.title = m.title;
    group.chapters.push({
      chapterId,
      label,
      chapterRaw: m ? m.chapter : undefined,
      pages: files.length,
      files,
      num,
    });
  }
  const out = [...groups.values()];
  for (const g of out) {
    g.chapters.sort((a, b) => {
      const an = Number.isFinite(a.num) ? a.num : Infinity;
      const bn = Number.isFinite(b.num) ? b.num : Infinity;
      return an - bn || a.label.localeCompare(b.label);
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export function useMangaDownloadGroups(): MangaDownloadGroup[] {
  const [groups, setGroups] = useState<MangaDownloadGroup[]>(listMangaDownloadGroups);
  useEffect(() => subscribeMangaDownloads(() => setGroups(listMangaDownloadGroups())), []);
  return groups;
}

export function useMangaDownloadsCount(): number {
  const compute = () => Object.keys(readManifest()).length;
  const [count, setCount] = useState(compute);
  useEffect(() => subscribeMangaDownloads(() => setCount(compute())), []);
  return count;
}

function recOf(chapterId: string): MangaDownloadRec {
  const existing = runtime.get(chapterId);
  if (existing) return existing;
  const files = readManifest()[chapterId];
  const rec: MangaDownloadRec = files?.length
    ? { status: "done", done: files.length, total: files.length, files }
    : { status: "idle", done: 0, total: 0, files: [] };
  runtime.set(chapterId, rec);
  return rec;
}

export function mangaDownloadStatus(chapterId: string): MangaDownloadRec {
  return recOf(chapterId);
}

function batchRecOf(mangaId: string): MangaDownloadBatchRec {
  return batchRuntime.get(mangaId) ?? { status: "idle", done: 0, total: 0, failed: 0 };
}

function setBatchRec(mangaId: string, patch: Partial<MangaDownloadBatchRec>): void {
  batchRuntime.set(mangaId, { ...batchRecOf(mangaId), ...patch });
  notify(`batch:${mangaId}`);
}

export function mangaDownloadBatchStatus(mangaId: string): MangaDownloadBatchRec {
  return batchRecOf(mangaId);
}

function setChapterPaused(chapterId: string | undefined, paused: boolean): void {
  if (!chapterId) return;
  const rec = recOf(chapterId);
  if (paused && rec.status === "downloading") {
    runtime.set(chapterId, { ...rec, status: "paused" });
    notify(chapterId);
  } else if (!paused && rec.status === "paused") {
    runtime.set(chapterId, { ...rec, status: "downloading" });
    notify(chapterId);
  }
}

export function pauseMangaDownloadBatch(mangaId: string): void {
  const control = batchControls.get(mangaId);
  if (!control || batchRecOf(mangaId).status !== "downloading") return;
  control.paused = true;
  setChapterPaused(control.currentChapterId, true);
  setBatchRec(mangaId, { status: "paused" });
}

export function resumeMangaDownloadBatch(mangaId: string): void {
  const control = batchControls.get(mangaId);
  if (!control || batchRecOf(mangaId).status !== "paused") return;
  control.paused = false;
  setChapterPaused(control.currentChapterId, false);
  setBatchRec(mangaId, { status: "downloading" });
  for (const resolve of control.waiters) resolve();
  control.waiters.clear();
}

function waitForBatch(control?: BatchControl): Promise<void> {
  if (!control?.paused) return Promise.resolve();
  return new Promise((resolve) => control.waiters.add(resolve));
}

export async function downloadedPages(chapterId: string): Promise<string[] | null> {
  const files = readManifest()[chapterId];
  if (!files?.length) return null;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return files.map((f) => convertFileSrc(f));
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || "item";
}

function extOf(url: string): string {
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

const IMG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

async function downloadChapterWithControl(
  mangaId: string,
  chapterId: string,
  info?: MangaDownloadInfo,
  batchControl?: BatchControl,
): Promise<boolean> {
  const cur = recOf(chapterId);
  if (cur.status === "downloading" || cur.status === "paused" || cur.status === "done") {
    return cur.status === "done";
  }

  const setRec = (patch: Partial<MangaDownloadRec>) => {
    runtime.set(chapterId, { ...recOf(chapterId), ...patch });
    notify(chapterId);
  };

  try {
    setRec({
      status: batchControl?.paused ? "paused" : "downloading",
      done: 0,
      total: 0,
      files: [],
    });
    await waitForBatch(batchControl);
    const urls = (await chapterPages(chapterId)).filter((u) => /^https?:/i.test(u));
    if (!urls.length) {
      setRec({ status: "error" });
      return false;
    }
    setRec({ total: urls.length });

    const { join } = await import("@tauri-apps/api/path");
    const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

    const base = getMangaDownloadDir() || (await defaultMangaDownloadDir());
    const dir = await join(base, safeName(mangaId), safeName(chapterId));
    await mkdir(dir, { recursive: true });

    const fetchBytes = async (url: string): Promise<Uint8Array> => {
      try {
        const r = await tauriFetch(url, { headers: IMG_HEADERS });
        if (r.ok) return new Uint8Array(await r.arrayBuffer());
      } catch {
        /* direct fetch blocked (e.g. local Suwayomi server) - fall back to the in-app proxy */
      }
      const r = await fetch(`/manga-img?u=${encodeURIComponent(url)}`);
      if (!r.ok) throw new Error(`page fetch failed: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    };

    const files: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      await waitForBatch(batchControl);
      const bytes = await fetchBytes(urls[i]);
      await waitForBatch(batchControl);
      const path = await join(dir, `${String(i + 1).padStart(4, "0")}.${extOf(urls[i])}`);
      await writeFile(path, bytes);
      files.push(path);
      setRec({ done: i + 1, files: [...files] });
    }

    const manifest = readManifest();
    manifest[chapterId] = files;
    writeManifest(manifest);
    const meta = readMeta();
    meta[chapterId] = {
      mangaId,
      title: info?.title,
      cover: info?.cover,
      chapter: info?.chapter ?? null,
      at: Date.now(),
    };
    writeMeta(meta);
    setRec({ status: "done", files });
    return true;
  } catch (e) {
    console.error("[manga-download] chapter failed", chapterId, e);
    setRec({ status: "error" });
    return false;
  }
}

export function downloadChapter(
  mangaId: string,
  chapterId: string,
  info?: MangaDownloadInfo,
): Promise<boolean> {
  return downloadChapterWithControl(mangaId, chapterId, info);
}

export async function downloadAllChapters(
  mangaId: string,
  items: Array<{ chapterId: string; info?: MangaDownloadInfo }>,
): Promise<void> {
  const running = batchControls.get(mangaId);
  if (running?.promise) return running.promise;

  const pending = items.filter((item) => {
    const status = recOf(item.chapterId).status;
    return status !== "done" && status !== "downloading" && status !== "paused";
  });
  const control: BatchControl = { paused: false, waiters: new Set() };
  batchControls.set(mangaId, control);
  setBatchRec(mangaId, { status: "downloading", done: 0, total: pending.length, failed: 0 });

  const job = (async () => {
    let done = 0;
    let failed = 0;
    for (const item of pending) {
      await waitForBatch(control);
      control.currentChapterId = item.chapterId;
      const ok = await downloadChapterWithControl(mangaId, item.chapterId, item.info, control);
      if (ok) done += 1;
      else failed += 1;
      setBatchRec(mangaId, { done, failed });
    }
    setBatchRec(mangaId, { status: failed > 0 ? "error" : "done", done, failed });
  })().finally(() => {
    control.currentChapterId = undefined;
    control.promise = undefined;
  });

  control.promise = job;
  return job;
}

async function removeChapterDir(firstFile: string): Promise<void> {
  try {
    const dir = firstFile.replace(/[\\/][^\\/]*$/, "");
    const custom = getMangaDownloadDir();
    const inDefault = /manga-downloads[\\/]/.test(dir);
    const inCustom = !!custom && dir.startsWith(custom);
    if (!inDefault && !inCustom) return;
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(dir, { recursive: true });
  } catch {
    return;
  }
}

export function deleteMangaDownload(chapterId: string): void {
  const manifest = readManifest();
  const files = manifest[chapterId];
  delete manifest[chapterId];
  writeManifest(manifest);
  const meta = readMeta();
  delete meta[chapterId];
  writeMeta(meta);
  runtime.set(chapterId, { status: "idle", done: 0, total: 0, files: [] });
  notify(chapterId);
  if (files?.length) void removeChapterDir(files[0]);
}

export function useMangaDownload(chapterId: string): MangaDownloadRec {
  const [rec, setRec] = useState<MangaDownloadRec>(() => mangaDownloadStatus(chapterId));
  useEffect(() => {
    const sync = (changed?: string) => {
      if (!changed || changed === chapterId) setRec(mangaDownloadStatus(chapterId));
    };
    sync();
    return subscribeMangaDownloads(sync);
  }, [chapterId]);
  return rec;
}

export function useMangaDownloadBatch(mangaId: string): MangaDownloadBatchRec {
  const [rec, setRec] = useState<MangaDownloadBatchRec>(() => mangaDownloadBatchStatus(mangaId));
  useEffect(() => {
    const sync = (changed?: string) => {
      if (!changed || changed === `batch:${mangaId}`) setRec(mangaDownloadBatchStatus(mangaId));
    };
    sync();
    return subscribeMangaDownloads(sync);
  }, [mangaId]);
  return rec;
}
