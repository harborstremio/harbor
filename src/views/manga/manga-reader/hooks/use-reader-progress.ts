import { useEffect } from "react";
import type { RefObject } from "react";
import { recordMangaProgress } from "@/lib/manga-progress";
import { setMangaReading } from "@/lib/manga-reading-state";
import { activeMangaSourceId } from "@/lib/manga/sources";
import type { MangaChapter } from "@/lib/manga/api";

type Args = {
  pid: string;
  manga: { id: string; title: string; cover?: string };
  chapter: MangaChapter;
  label: string;
  total: number;
  currentPage: number;
  index: number;
  loading: boolean;
  failed: boolean;
  paged: boolean;
  book: boolean;
  settled: RefObject<boolean>;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function useReaderProgress(a: Args): (page: number) => void {
  const { pid, manga, chapter, label, total, currentPage, index, loading, failed, paged, book, settled, scrollRef } = a;

  useEffect(() => {
    if (loading || failed || total === 0 || !manga.title) return;
    setMangaReading({
      mangaId: manga.id,
      title: manga.title,
      cover: manga.cover,
      chapter: chapter.chapter,
      chapterLabel: label,
      page: Math.min(currentPage + 1, total),
      totalPages: total,
    });
  }, [loading, failed, total, currentPage, index, manga.id, manga.title, manga.cover, chapter.id, chapter.chapter, label]);

  useEffect(() => {
    if (book || !settled.current || loading || failed || total === 0 || !manga.title) return;
    setMangaReading({
      mangaId: manga.id,
      title: manga.title,
      cover: manga.cover,
      chapter: chapter.chapter,
      chapterLabel: label,
      page: Math.min(currentPage + 1, total),
      totalPages: total,
    });
    const t = window.setTimeout(() => {
      const root = scrollRef.current;
      const scroll =
        !paged && root && root.scrollHeight > 0 ? root.scrollTop / root.scrollHeight : undefined;
      recordMangaProgress(pid, {
        id: manga.id,
        title: manga.title,
        cover: manga.cover,
        sourceId: activeMangaSourceId(),
        chapterId: chapter.id,
        chapterNumber: chapter.chapter,
        chapterLabel: label,
        page: Math.min(currentPage + 1, total),
        totalPages: total,
        scroll,
        updatedAt: Date.now(),
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [currentPage, total, index, loading, failed, paged, book, pid, manga.id, manga.title, manga.cover, chapter.id, chapter.chapter, label, settled, scrollRef]);

  return (p: number) => {
    if (!manga.title || total === 0) return;
    const page = Math.min(p + 1, total);
    setMangaReading({
      mangaId: manga.id,
      title: manga.title,
      cover: manga.cover,
      chapter: chapter.chapter,
      chapterLabel: label,
      page,
      totalPages: total,
    });
    recordMangaProgress(pid, {
      id: manga.id,
      title: manga.title,
      cover: manga.cover,
      sourceId: activeMangaSourceId(),
      chapterId: chapter.id,
      chapterNumber: chapter.chapter,
      chapterLabel: label,
      page,
      totalPages: total,
      updatedAt: Date.now(),
    });
  };
}
