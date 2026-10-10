import { useEffect, useState } from "react";
import { useProfiles } from "./profiles";
import { persistCritical } from "./storage-recovery";

export type MangaBookmark = {
  id: string;
  mangaId: string;
  title: string;
  cover?: string;
  sourceId?: string;
  chapterId: string;
  chapterNumber: string | null;
  chapterLabel: string;
  page: number;
  totalPages: number;
  name: string;
  createdAt: number;
};

const PREFIX = "harbor.mangabookmarks.v1.";
const keyFor = (pid: string) => PREFIX + pid;
const MAX = 300;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeMangaBookmarks(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function listMangaBookmarks(pid: string): MangaBookmark[] {
  try {
    const raw = localStorage.getItem(keyFor(pid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((b) => b && typeof b.id === "string" && typeof b.chapterId === "string");
  } catch {
    return [];
  }
}

function write(pid: string, list: MangaBookmark[]): void {
  persistCritical(keyFor(pid), JSON.stringify(list.slice(0, MAX)));
}

function makeId(): string {
  return `bm${Date.now().toString(36)}${Math.floor(performance.now() % 1000).toString(36)}`;
}

export function addMangaBookmark(
  pid: string,
  entry: Omit<MangaBookmark, "id" | "name" | "createdAt"> & { name?: string },
): MangaBookmark {
  const bm: MangaBookmark = {
    ...entry,
    id: makeId(),
    name: entry.name?.trim() || defaultName(entry.chapterLabel, entry.page),
    createdAt: Date.now(),
  };
  write(pid, [bm, ...listMangaBookmarks(pid)]);
  notify();
  return bm;
}

export function renameMangaBookmark(pid: string, id: string, name: string): void {
  const trimmed = name.trim();
  write(
    pid,
    listMangaBookmarks(pid).map((b) => (b.id === id ? { ...b, name: trimmed || b.name } : b)),
  );
  notify();
}

export function removeMangaBookmark(pid: string, id: string): void {
  write(pid, listMangaBookmarks(pid).filter((b) => b.id !== id));
  notify();
}

export function defaultName(chapterLabel: string, page: number): string {
  return `${chapterLabel} · p${page}`;
}

export function useMangaBookmarks(mangaId?: string): MangaBookmark[] {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [items, setItems] = useState<MangaBookmark[]>(() => listMangaBookmarks(pid));
  useEffect(() => {
    const sync = () => setItems(listMangaBookmarks(pid));
    sync();
    return subscribeMangaBookmarks(sync);
  }, [pid]);
  return mangaId ? items.filter((b) => b.mangaId === mangaId) : items;
}
