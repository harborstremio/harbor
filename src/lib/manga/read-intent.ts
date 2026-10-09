import type { MangaProgressEntry } from "@/lib/manga-progress";

let pending: MangaProgressEntry | null = null;

export function setMangaReadIntent(entry: MangaProgressEntry): void {
  pending = entry;
}

export function takeMangaReadIntent(mangaId: string): MangaProgressEntry | null {
  const p = pending;
  pending = null;
  return p && p.id === mangaId ? p : null;
}

export type MangaChapterIntent = { mangaId: string; chapterId: string };

let pendingChapter: MangaChapterIntent | null = null;

export function setMangaChapterIntent(intent: MangaChapterIntent): void {
  pendingChapter = intent;
}

export function takeMangaChapterIntent(mangaId: string): MangaChapterIntent | null {
  const p = pendingChapter;
  pendingChapter = null;
  return p && p.mangaId === mangaId ? p : null;
}

export const MANGA_READ_CHAPTER_EVENT = "harbor:read-chapter";

export function requestMangaChapterRead(mangaId: string, chapterId: string): void {
  setMangaChapterIntent({ mangaId, chapterId });
  window.dispatchEvent(
    new CustomEvent<MangaChapterIntent>(MANGA_READ_CHAPTER_EVENT, {
      detail: { mangaId, chapterId },
    }),
  );
}
