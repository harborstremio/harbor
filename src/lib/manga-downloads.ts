import { useEffect, useState } from "react";
import { chapterPages } from "@/lib/manga/api";
import { isExpectedChapterDir } from "@/lib/manga/download-path";

export { isExpectedChapterDir } from "@/lib/manga/download-path";

export type MangaDownloadStatus = "idle" | "downloading" | "done" | "error";

export type MangaDownloadRec = {
  status: MangaDownloadStatus;
  done: number;
  total: number;
  files: string[];
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
const listeners = new Set<(changed?: string) => void>();

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

export async function downloadChapter(
  mangaId: string,
  chapterId: string,
  info?: MangaDownloadInfo,
): Promise<void> {
  const cur = recOf(chapterId);
  if (cur.status === "downloading" || cur.status === "done") return;

  const setRec = (patch: Partial<MangaDownloadRec>) => {
    runtime.set(chapterId, { ...recOf(chapterId), ...patch });
    notify(chapterId);
  };

  try {
    setRec({ status: "downloading", done: 0, total: 0, files: [] });
    const urls = (await chapterPages(chapterId)).filter((u) => /^https?:/i.test(u));
    if (!urls.length) {
      setRec({ status: "error" });
      return;
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
      const bytes = await fetchBytes(urls[i]);
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
  } catch (e) {
    console.error("[manga-download] chapter failed", chapterId, e);
    setRec({ status: "error" });
  }
}

export async function downloadAllChapters(
  mangaId: string,
  items: Array<{ chapterId: string; info?: MangaDownloadInfo }>,
): Promise<void> {
  for (const it of items) {
    const rec = recOf(it.chapterId);
    if (rec.status === "done" || rec.status === "downloading") continue;
    await downloadChapter(mangaId, it.chapterId, it.info);
  }
}

async function removeChapterDir(
  firstFile: string,
  mangaId: string | undefined,
  chapterId: string,
): Promise<void> {
  try {
    if (!mangaId) return;
    const { dirname, join, normalize } = await import("@tauri-apps/api/path");
    const base = getMangaDownloadDir() || (await defaultMangaDownloadDir());
    const dir = await normalize(await dirname(firstFile));
    const expected = await normalize(await join(base, safeName(mangaId), safeName(chapterId)));
    if (!isExpectedChapterDir(dir, expected)) return;
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(dir, { recursive: true });
  } catch {
    return;
  }
}

export function deleteMangaDownload(chapterId: string): void {
  const manifest = readManifest();
  const files = manifest[chapterId];
  const chapterMeta = readMeta()[chapterId];
  delete manifest[chapterId];
  writeManifest(manifest);
  const meta = readMeta();
  delete meta[chapterId];
  writeMeta(meta);
  runtime.set(chapterId, { status: "idle", done: 0, total: 0, files: [] });
  notify(chapterId);
  if (files?.length) void removeChapterDir(files[0], chapterMeta?.mangaId, chapterId);
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
