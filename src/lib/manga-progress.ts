import { useEffect, useState } from "react";
import { useProfiles } from "./profiles";
import { queueSuwayomiProgress } from "./manga/sources/suwayomi/progress-bridge";

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
  completed?: boolean;
  upNext?: boolean;
};

const PREFIX = "harbor.mangaread.v1.";
const keyFor = (pid: string) => PREFIX + pid;
const MAX = 24;

const READ_PREFIX = "harbor.mangaread.chapters.v1.";
const readKeyFor = (pid: string) => READ_PREFIX + pid;
const READ_MAX_PER_MANGA = 500;

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
    return arr.filter(
      (e) => e && typeof e.id === "string" && typeof e.chapterId === "string",
    );
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
  if (entry.completed === true) {
    recordMangaChapterRead(pid, entry.id, entry.chapterId, true);
  }
  notify();
  if (entry.upNext) return;
  queueSuwayomiProgress({
    sourceId: entry.sourceId,
    chapterId: entry.chapterId,
    page: Math.max(0, entry.page - 1),
    totalPages: entry.totalPages,
    completed: entry.completed,
  });
}

export function removeMangaProgressEntry(pid: string, id: string): void {
  write(pid, listMangaProgress(pid).filter((e) => e.id !== id));
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

export function listReadMangaChapters(pid: string, mangaId: string): string[] {
  try {
    const raw = localStorage.getItem(readKeyFor(pid));
    if (!raw) return [];
    const rec = JSON.parse(raw) as Record<string, string[]>;
    const arr = rec?.[mangaId];
    return Array.isArray(arr) ? arr.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function recordMangaChapterRead(
  pid: string,
  mangaId: string,
  chapterId: string,
  silent = false,
): void {
  if (!mangaId || !chapterId) return;
  try {
    const raw = localStorage.getItem(readKeyFor(pid));
    let rec: Record<string, string[]> = {};
    if (raw != null) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed != null && typeof parsed === "object") rec = parsed as Record<string, string[]>;
    }
    const prev = Array.isArray(rec[mangaId]) ? rec[mangaId] : [];
    if (prev.includes(chapterId)) return;
    rec[mangaId] = [chapterId, ...prev].slice(0, READ_MAX_PER_MANGA);
    localStorage.setItem(readKeyFor(pid), JSON.stringify(rec));
  } catch {
    return;
  }
  if (!silent) notify();
}

export function useReadMangaChapterIds(mangaId?: string): Set<string> {
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const [ids, setIds] = useState<Set<string>>(
    () => new Set(mangaId ? listReadMangaChapters(pid, mangaId) : []),
  );
  useEffect(() => {
    const sync = () => setIds(new Set(mangaId ? listReadMangaChapters(pid, mangaId) : []));
    sync();
    return subscribeMangaProgress(sync);
  }, [pid, mangaId]);
  return ids;
}

export function removeMangaChapterRead(pid: string, mangaId: string, chapterId: string): void {
  if (!mangaId || !chapterId) return;
  try {
    const raw = localStorage.getItem(readKeyFor(pid));
    if (raw == null) return;
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object") return;
    const rec = parsed as Record<string, string[]>;
    const prev = Array.isArray(rec[mangaId]) ? rec[mangaId] : [];
    if (!prev.includes(chapterId)) return;
    const next = prev.filter((v) => v !== chapterId);
    if (next.length === 0) delete rec[mangaId];
    else rec[mangaId] = next;
    localStorage.setItem(readKeyFor(pid), JSON.stringify(rec));
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
