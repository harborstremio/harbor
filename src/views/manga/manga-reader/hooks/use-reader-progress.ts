import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { recordMangaProgress } from "@/lib/manga-progress";
import { setMangaReading } from "@/lib/manga-reading-state";
import { activeMangaSourceId } from "@/lib/manga/sources";
import type { MangaChapter } from "@/lib/manga/api";

const COMPLETED_BOTTOM_PX = 8;

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
  disabled?: boolean;
  onCompleted?: () => void;
};

export function useReaderProgress(a: Args): (page: number) => void {
  const {
    pid,
    manga,
    chapter,
    label,
    total,
    currentPage,
    index,
    loading,
    failed,
    paged,
    book,
    settled,
    scrollRef,
    disabled,
    onCompleted,
  } = a;

  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const completedKeyRef = useRef<string | null>(null);
  const completedStateRef = useRef(false);
  const liveRef = useRef({ loading, failed, total, currentPage, paged, book, settled: false });
  liveRef.current = {
    loading,
    failed,
    total,
    currentPage,
    paged,
    book,
    settled: settled.current,
  };
  const idsRef = useRef({ mangaId: manga.id, chapterId: chapter.id });
  idsRef.current = { mangaId: manga.id, chapterId: chapter.id };

  const isCompleteNow = (page?: number) => {
    const s = liveRef.current;
    if (s.loading || s.failed || s.total === 0) return false;
    const at = page ?? s.currentPage;
    if (s.book) return s.total <= 1 || at >= s.total - 2;
    if (s.paged) return at >= s.total;
    if (at < s.total - 1) return false;
    const root = scrollRef.current;
    if (!root || root.scrollHeight <= root.clientHeight + 2) return true;
    return root.scrollTop + root.clientHeight >= root.scrollHeight - COMPLETED_BOTTOM_PX;
  };

  const fireCompleted = (page?: number): boolean => {
    const ids = idsRef.current;
    const key = `${ids.mangaId}|${ids.chapterId}`;
    if (completedKeyRef.current !== key) {
      completedKeyRef.current = key;
      completedStateRef.current = false;
    }
    const done = isCompleteNow(page);
    const was = completedStateRef.current;
    completedStateRef.current = done;
    if (done && !was) onCompletedRef.current?.();
    return done && !was;
  };

  useEffect(() => {
    if (disabled) return;
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = liveRef.current;
        if (s.paged || s.book || !s.settled) return;
        fireCompleted();
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [disabled, scrollRef]);

  useEffect(() => {
    if (disabled || loading || failed || total === 0 || !manga.title) return;
    setMangaReading({
      mangaId: manga.id,
      title: manga.title,
      cover: manga.cover,
      chapter: chapter.chapter,
      chapterLabel: label,
      page: Math.min(currentPage + 1, total),
      totalPages: total,
    });
  }, [
    loading,
    failed,
    total,
    currentPage,
    index,
    manga.id,
    manga.title,
    manga.cover,
    chapter.id,
    chapter.chapter,
    label,
    disabled,
  ]);

  useEffect(() => {
    if (disabled || book || !settled.current || loading || failed || total === 0 || !manga.title)
      return;
    fireCompleted();
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
      if (completedKeyRef.current === `${manga.id}|${chapter.id}` && completedStateRef.current)
        return;
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
  }, [
    currentPage,
    total,
    index,
    loading,
    failed,
    paged,
    book,
    pid,
    manga.id,
    manga.title,
    manga.cover,
    chapter.id,
    chapter.chapter,
    label,
    settled,
    scrollRef,
    disabled,
  ]);

  return (p: number) => {
    if (disabled || !manga.title || total === 0) return;
    const page = Math.min(p + 1, total);
    const justCompleted = fireCompleted(p);
    setMangaReading({
      mangaId: manga.id,
      title: manga.title,
      cover: manga.cover,
      chapter: chapter.chapter,
      chapterLabel: label,
      page,
      totalPages: total,
    });
    if (justCompleted) return;
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
