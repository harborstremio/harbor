import { useEffect, useState } from "react";
import { useProfiles } from "./profiles";

export type MangaProgressEntry = {
  id: string;
  title: string;
  cover?: string;
  sourceId?: string;
  chapterId: string;
  chapterNumber: string | null;
  chapterLabel: string;
  page: number;
  totalPages: number;
  scroll?: number;
  updatedAt: number;
};

const PREFIX = "harbor.mangaread.v1.";
const keyFor = (pid: string) => PREFIX + pid;
const MAX = 24;

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function subscribeMangaProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function listMangaProgress(pid: string): MangaProgressEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(pid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.id === "string" && typeof e.chapterId === "string");
  } catch {
    return [];
  }
}

function write(pid: string, list: MangaProgressEntry[]): void {
  try {
    localStorage.setItem(keyFor(pid), JSON.stringify(list.slice(0, MAX)));
  } catch {
    return;
  }
}

export function recordMangaProgress(pid: string, entry: MangaProgressEntry): void {
  if (!entry.id || !entry.title) return;
  const prev = listMangaProgress(pid).filter((e) => e.id !== entry.id);
  write(pid, [entry, ...prev]);
  notify();
}

export function removeMangaProgressEntry(pid: string, id: string): void {
  write(
    pid,
    listMangaProgress(pid).filter((e) => e.id !== id),
  );
  notify();
}

export function removeMangaProgress(pid: string): void {
  try {
    localStorage.removeItem(keyFor(pid));
  } catch {
    return;
  }
  notify();
}

export function useMangaProgressList(): MangaProgressEntry[] {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [items, setItems] = useState<MangaProgressEntry[]>(() => listMangaProgress(pid));
  useEffect(() => {
    const sync = () => setItems(listMangaProgress(pid));
    sync();
    return subscribeMangaProgress(sync);
  }, [pid]);
  return items;
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function useMangaProgressEntry(id?: string, title?: string): MangaProgressEntry | undefined {
  const items = useMangaProgressList();
  if (id) {
    const byId = items.find((e) => e.id === id);
    if (byId) return byId;
  }
  if (title) {
    const key = normTitle(title);
    if (key) return items.find((e) => normTitle(e.title) === key);
  }
  return undefined;
}

export function resumePageForChapter(
  pid: string,
  mangaId: string,
  mangaTitle: string,
  chapterId: string,
  chapterNumber: string | null,
): number | undefined {
  const items = listMangaProgress(pid);
  const key = normTitle(mangaTitle);
  const entry =
    items.find((e) => e.id === mangaId) ??
    (key ? items.find((e) => normTitle(e.title) === key) : undefined);
  if (!entry) return undefined;
  const sameChapter =
    entry.chapterId === chapterId ||
    (entry.chapterNumber != null && chapterNumber != null && entry.chapterNumber === chapterNumber);
  if (!sameChapter) return undefined;
  const page = Math.max(0, (entry.page ?? 1) - 1);
  return page > 0 ? page : undefined;
}
