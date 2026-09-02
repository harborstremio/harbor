import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark } from "lucide-react";
import { chapterPages, type MangaChapter } from "@/lib/manga/api";
import { pageHeadersFor } from "@/lib/manga/plugins/adapter";
import { t, useT } from "@/lib/i18n";
import { downloadedPages } from "@/lib/manga-downloads";
import { recordMangaProgress, resumePageForChapter } from "@/lib/manga-progress";
import { clearMangaReading } from "@/lib/manga-reading-state";
import { activeMangaSourceId, listMangaSources } from "@/lib/manga/sources";
import { useProfiles } from "@/lib/profiles";
import { readWindowFullscreen, setWindowFullscreen } from "@/lib/window";
import { ReaderBar } from "./manga-reader/reader-bar";
import { ReaderFooter } from "./manga-reader/reader-footer";
import { ReaderPageJump } from "./manga-reader/reader-page-jump";
import { ReaderSettings } from "./manga-reader/reader-settings";
import { PageImage } from "./manga-reader/page-image";
import { BookFlip, type BookApi } from "./manga-reader/book-view";
import { ReaderNav } from "./manga-reader/reader-nav";
import { BookmarksPanel, BookmarkPagePicker } from "./manga-reader/reader-bookmarks";
import { useReaderProgress } from "./manga-reader/hooks/use-reader-progress";
import { useReaderPaging } from "./manga-reader/hooks/use-reader-paging";
import { detectWebtoon } from "./manga-reader/reader-utils";
import { addMangaBookmark, type MangaBookmark } from "@/lib/manga-bookmarks";
import { chapterSourceOf } from "./manga-reader/reader-source-menu";
import { useMangaRemoteBinding } from "@/lib/remote/use-manga-remote-binding";
import { useBookTurnQueue } from "./manga-reader/hooks/use-book-turn-queue";
import {
  BG,
  BG_HEX,
  doublePageStyle,
  loadPrefs,
  pageStyle,
  PREFS_KEY,
} from "./manga-reader/reader-prefs";
import {
  EndOfChapterHint,
  ReaderComplete,
  ReaderFailed,
  ReaderLoading,
} from "./manga-reader/reader-states";
import type { ReaderPrefs, MangaPage } from "./manga-reader/reader-types";

export function MangaReader({
  chapters,
  index,
  manga,
  startPage,
  startScroll,
  pagesOverride,
  prefsKey = PREFS_KEY,
  disableMangaPersistence = false,
  onPageChange,
  onExit,
  onChangeIndex,
}: {
  chapters: MangaChapter[];
  index: number;
  manga: { id: string; title: string; cover?: string };
  startPage?: number;
  startScroll?: number;
  pagesOverride?: MangaPage[];
  prefsKey?: string;
  disableMangaPersistence?: boolean;
  onPageChange?: (page: number) => void;
  onExit: () => void;
  onChangeIndex: (i: number) => void;
}) {
  const chapter = chapters[index];
  const t = useT();
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => loadPrefs(prefsKey));
  const [currentPage, setCurrentPage] = useState(0);
  const [bookSpread, setBookSpread] = useState("");
  const [chromeOpen, setChromeOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => setHintDismissed(false), [index]);
  const [pickBookmark, setPickBookmark] = useState(false);
  const [autoLong, setAutoLong] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Array<HTMLDivElement | null>>([]);
  const hideTimer = useRef<number | undefined>(undefined);
  const didSeek = useRef(false);
  const settled = useRef(false);
  const bookApi = useRef<BookApi | null>(null);
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";

  const total = pages.length;
  const pageUrls = useMemo(() => pages.map((p) => p.url), [pages]);
  const readingOrder = useMemo(() => {
    const num = (c: MangaChapter) => parseFloat(c.chapter ?? "") || 0;
    return chapters.map((_, i) => i).sort((a, b) => num(chapters[a]) - num(chapters[b]) || a - b);
  }, [chapters]);
  const orderPos = readingOrder.indexOf(index);
  const prevIndex = orderPos > 0 ? readingOrder[orderPos - 1] : null;
  const nextIndex =
    orderPos >= 0 && orderPos < readingOrder.length - 1 ? readingOrder[orderPos + 1] : null;
  const atFirstChapter = orderPos <= 0;
  const atLastChapter = orderPos === -1 || orderPos === readingOrder.length - 1;
  const effMode = autoLong ? "long" : prefs.mode;
  const effModeRef = useRef(effMode);
  effModeRef.current = effMode;
  const double = effMode === "double";
  const book = effMode === "book";
  const horizontal = effMode === "long-h";
  const paged = effMode === "paged" || double || book;
  const rtl = prefs.rtl;
  const autoNext = prefs.autoNextChapter;
  const step = double ? 2 : 1;
  const lastStart = double ? total - (total % 2 === 0 ? 2 : 1) : total - 1;
  const complete = paged && currentPage >= total && total > 0;
  const bookSpreadLast =
    book && bookSpread
      ? Math.max(
          0,
          ...bookSpread
            .split("-")
            .map(Number)
            .filter((n) => Number.isFinite(n)),
        )
      : 0;
  const bookAtEnd = book && total > 0 && bookSpreadLast >= total;

  const patchPrefs = (patch: Partial<ReaderPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });

  const zoomBy = (delta: number) =>
    setPrefs((p) => {
      const lo = effModeRef.current === "book" ? 1 : 0.5;
      const z = Math.max(lo, Math.min(3, Math.round((p.zoom + delta) * 100) / 100));
      const next = { ...p, zoom: z };
      try {
        localStorage.setItem(prefsKey, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPages([]);
    setCurrentPage(0);
    setBookSpread("");
    setAutoLong(false);
    settled.current = false;
    pageEls.current = [];
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
    if (pagesOverride) {
      setPages(pagesOverride);
      setFailed(!pagesOverride.length);
      setLoading(false);
      setCurrentPage(Math.max(0, Math.min(pagesOverride.length - 1, startPage ?? 0)));
      didSeek.current = true;
      settled.current = true;
      return;
    }
    downloadedPages(chapter.id)
      .then((local) => local ?? chapterPages(chapter.id))
      .then((urls) => {
        if (cancelled) return;
        if (!urls.length) {
          setFailed(true);
          setLoading(false);
          return;
        }
        setPages(
          urls.map((u) => {
            const h = pageHeadersFor(u);
            return h ? { url: u, headers: h } : { url: u };
          }),
        );
        setLoading(false);
        void detectWebtoon(urls).then((w) => {
          if (!cancelled) setAutoLong(w);
        });
        const localResume = resumePageForChapter(
          pid,
          manga.id,
          manga.title,
          chapter.id,
          chapter.chapter,
        );
        const serverResume =
          typeof chapter.serverPage === "number" && chapter.serverPage > 0 && !chapter.serverRead
            ? chapter.serverPage
            : null;
        const synced =
          serverResume != null && (localResume == null || serverResume > localResume)
            ? serverResume
            : localResume;
        const resumeTo =
          startPage != null && synced != null ? Math.max(startPage, synced) : (startPage ?? synced);
        const firstLoad = !didSeek.current;
        didSeek.current = true;
        if (firstLoad && (resumeTo != null || startScroll)) {
          const sp = Math.max(0, Math.min(urls.length - 1, resumeTo ?? 0));
          window.setTimeout(() => {
            const m = effModeRef.current;
            if (m === "paged" || m === "double") {
              setCurrentPage(m === "double" ? sp - (sp % 2) : sp);
            } else {
              const el = pageEls.current[sp];
              if (el) {
                el.scrollIntoView(
                  m === "long-h" ? { inline: "center", block: "nearest" } : { block: "start" },
                );
                setCurrentPage(sp);
              } else if (startScroll && scrollRef.current) {
                const root = scrollRef.current;
                root.scrollTo({ top: startScroll * root.scrollHeight });
              }
            }
            settled.current = true;
          }, 280);
        } else {
          settled.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chapter.id, pagesOverride, reloadTick, startPage]);

  useEffect(() => {
    const bump = () => {
      setChromeOpen(true);
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setChromeOpen(false), 2600);
    };
    bump();
    window.addEventListener("mousemove", bump);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!prefs.focusMode) {
      setEdge({ top: false, bottom: false });
      return;
    }
    const onMove = (e: MouseEvent) => {
      const h = window.innerHeight;
      setEdge({ top: e.clientY <= 56, bottom: e.clientY >= h - 64 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [prefs.focusMode]);

  useEffect(() => {
    readWindowFullscreen().then(setFullscreen);
  }, []);

  const toggleFullscreen = () => {
    const nf = !fullscreen;
    setFullscreen(nf);
    void setWindowFullscreen(nf);
  };

  useEffect(() => {
    if (paged || loading || failed) return;
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.page);
            if (Number.isFinite(i)) setCurrentPage(i);
          }
        }
      },
      { root, rootMargin: horizontal ? "0px -45% 0px -45%" : "-45% 0px -45% 0px" },
    );
    pageEls.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [paged, horizontal, loading, failed, pages]);

  useEffect(
    () => (disableMangaPersistence ? undefined : clearMangaReading),
    [disableMangaPersistence],
  );

  const label = chapterLabel(chapter);
  const recordBookPage = useReaderProgress({
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
    disabled: disableMangaPersistence,
  });

  useEffect(() => {
    if (settled.current && total > 0) onPageChange?.(currentPage);
  }, [currentPage, onPageChange, total]);

  const { goToPage, nextPage, prevPage } = useReaderPaging({
    paged,
    double,
    horizontal,
    rtl: prefs.rtl,
    total,
    currentPage,
    step,
    lastStart,
    nextIndex,
    prevIndex,
    autoNext,
    setCurrentPage,
    onChangeIndex,
    pageEls,
    scrollRef,
  });

  const atChapterEnd = !loading && !failed && !complete && bookAtEnd;
  const advanceFromBookEnd = () => {
    if (nextIndex == null) return;
    if (autoNext) onChangeIndex(nextIndex);
    else setCurrentPage(total);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const navKey = e.key === " " || e.key === "ArrowRight" || e.key === "ArrowLeft";
      if (
        navKey &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement.tagName === "BUTTON"
      ) {
        document.activeElement.blur();
      }
      if (e.key === "Escape") {
        if (!settingsOpen) onExit();
      } else if (bookAtEnd && (e.key === " " || e.key === (rtl ? "ArrowLeft" : "ArrowRight"))) {
        e.preventDefault();
        advanceFromBookEnd();
      } else if (e.key === " " && !book) {
        e.preventDefault();
        nextPage();
      } else if (e.key === "ArrowRight" && !book) {
        e.preventDefault();
        if (rtl && (paged || horizontal)) prevPage();
        else nextPage();
      } else if (e.key === "ArrowLeft" && !book) {
        e.preventDefault();
        if (rtl && (paged || horizontal)) nextPage();
        else prevPage();
      } else if (e.key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pStyle = pageStyle(prefs.fit, prefs.zoom);
  const longStyle = { width: "100%", maxWidth: `${Math.round(880 * prefs.zoom)}px` };
  const hStyle = {
    height: `${Math.round(100 * prefs.zoom)}%`,
    width: "auto",
    maxWidth: "none",
  } as const;
  const dStyle = doublePageStyle(prefs.fit, prefs.zoom);
  const displayPage = Math.min(currentPage, Math.max(0, total - 1));
  const focus = prefs.focusMode;
  const barVisible = focus ? edge.top : chromeOpen;
  const footerVisible = focus ? edge.bottom : chromeOpen;
  const controlsVisible = focus ? edge.top || edge.bottom : chromeOpen;
  const bookResume = useMemo(
    () =>
      startPage ??
      (disableMangaPersistence
        ? 0
        : (resumePageForChapter(pid, manga.id, manga.title, chapter.id, chapter.chapter) ?? 0)),
    [chapter.id, startPage, pid, manga.id, manga.title, disableMangaPersistence],
  );
  const pageRef = useRef(currentPage);
  pageRef.current = currentPage;
  const [bookStart, setBookStart] = useState(bookResume);
  const wasBookRef = useRef(book);
  useEffect(() => {
    if (book && !wasBookRef.current) setBookStart(pageRef.current);
    wasBookRef.current = book;
  }, [book]);
  useEffect(() => {
    setBookStart(didSeek.current ? 0 : bookResume);
  }, [bookResume]);
  useEffect(() => {
    if ((effMode !== "long" && effMode !== "long-h") || loading || failed) return;
    const target = pageRef.current;
    if (target <= 0) return;
    const t = window.setTimeout(() => {
      pageEls.current[target]?.scrollIntoView(
        effMode === "long-h" ? { inline: "center", block: "nearest" } : { block: "start" },
      );
      setCurrentPage(target);
    }, 120);
    return () => window.clearTimeout(t);
  }, [effMode, loading, failed]);

  const rtlRef = useRef(rtl);
  useEffect(() => {
    const flipped = rtlRef.current !== rtl;
    rtlRef.current = rtl;
    if (!flipped || !horizontal || loading || failed) return;
    const target = pageRef.current;
    const t = window.setTimeout(() => {
      pageEls.current[target]?.scrollIntoView({ inline: "center", block: "nearest" });
    }, 60);
    return () => window.clearTimeout(t);
  }, [rtl, horizontal, loading, failed]);

  useEffect(() => {
    if (!horizontal || loading || failed) return;
    const root = scrollRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      root.scrollBy({ left: (prefs.rtl ? -1 : 1) * e.deltaY });
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [horizontal, loading, failed, prefs.rtl]);
  const spread = double && !complete ? [displayPage, displayPage + 1].filter((i) => i < total) : [];
  const orderedSpread = rtl ? spread.slice().reverse() : spread;

  const bookmarkCurrent = {
    mangaId: manga.id,
    title: manga.title,
    cover: manga.cover,
    sourceId: activeMangaSourceId(),
    chapterId: chapter.id,
    chapterNumber: chapter.chapter,
    chapterLabel: chapterLabel(chapter),
    page: Math.min(displayPage + 1, Math.max(1, total)),
    totalPages: total,
  };

  const jumpBookmark = (bm: MangaBookmark) => {
    setBookmarksOpen(false);
    const targetIdx = chapters.findIndex((c) => c.id === bm.chapterId);
    if (targetIdx < 0) return;
    const targetPage = Math.max(0, bm.page - 1);
    if (targetIdx === index) {
      if (book) {
        bookApi.current?.goToPage(bm.page);
        setCurrentPage(targetPage);
      } else {
        goToPage(targetPage);
      }
      return;
    }
    if (!disableMangaPersistence)
      recordMangaProgress(pid, {
        id: manga.id,
        title: manga.title,
        cover: manga.cover,
        sourceId: activeMangaSourceId(),
        chapterId: bm.chapterId,
        chapterNumber: bm.chapterNumber,
        chapterLabel: bm.chapterLabel,
        page: bm.page,
        totalPages: bm.totalPages,
        updatedAt: Date.now(),
      });
    didSeek.current = false;
    onChangeIndex(targetIdx);
  };

  const spreadPages = book
    ? (() => {
        const nums = bookSpread
          .split("-")
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0);
        return rtl ? nums.slice().reverse() : nums;
      })()
    : double
      ? orderedSpread.map((i) => i + 1)
      : [displayPage + 1];

  const bookmarkAtPage = (page: number) => {
    addMangaBookmark(pid, { ...bookmarkCurrent, page });
    setPickBookmark(false);
    setBookmarksOpen(true);
  };

  const startPickBookmark = () => {
    setBookmarksOpen(false);
    if (spreadPages.length <= 1) bookmarkAtPage(spreadPages[0] ?? displayPage + 1);
    else setPickBookmark(true);
  };

  const remoteChapters = useMemo(() => {
    const known = listMangaSources();
    const nameOf = (id: string) => {
      const src = known.find((s) => s.provider === id || s.id === id);
      return src?.name ?? id;
    };
    return chapters.map((c, i) => {
      const sourceId = chapterSourceOf(c) || undefined;
      return {
        id: c.id,
        index: i,
        label: chapterLabel(c),
        chapter: c.chapter,
        title: c.title,
        group: c.group,
        sourceId,
        sourceName: sourceId ? nameOf(sourceId) : undefined,
        downloaded: c.downloaded,
      };
    });
  }, [chapters]);

  const bookTurn = useBookTurnQueue(bookApi);

  const remoteSetPage = (page: number) => {
    const clamped = Math.max(0, Math.min(Math.max(0, total - 1), page));
    if (book) {
      bookApi.current?.goToPage(clamped + 1);
      setCurrentPage(clamped);
    } else {
      goToPage(clamped);
    }
  };

  useMangaRemoteBinding({
    mangaId: manga.id,
    title: manga.title,
    cover: manga.cover ?? null,
    pid,
    chapterId: chapter.id,
    chapterIndex: index,
    chapterLabel: label,
    chapters: remoteChapters,
    pageIndex: displayPage,
    pageCount: total,
    spread: spreadPages,
    pageUrls,
    zoom: prefs.zoom,
    canZoom: true,
    rtl,
    mode: effMode === "long-h" ? "long" : effMode,
    hasPrev: !atFirstChapter,
    hasNext: !atLastChapter,
    turnPage: (dir) => {
      if (book) bookTurn(dir);
      else if (dir === "next") nextPage();
      else prevPage();
    },
    setPage: remoteSetPage,
    jumpChapter: onChangeIndex,
    zoomBy,
    setZoom: (z) => patchPrefs({ zoom: book ? Math.max(1, z) : z }),
    pan: (dx, dy) => {
      if (book) bookApi.current?.pan?.(dx, dy);
      else scrollRef.current?.scrollBy({ left: dx, top: dy });
    },
    flipProgress: (p) => {
      if (book) bookApi.current?.drag?.(p);
    },
    flipEnd: (commit, dir) => {
      if (book) bookApi.current?.dragEnd?.(commit, dir);
    },
    setRtl: (r) => patchPrefs({ rtl: r }),
    bookmarkCurrent: () => bookmarkCurrent,
    jumpBookmark,
    close: onExit,
  });

  const completeCard = (
    <ReaderComplete
      atLastChapter={atLastChapter}
      label={chapterLabel(chapter)}
      onNext={() => nextIndex != null && onChangeIndex(nextIndex)}
      onExit={onExit}
    />
  );

  return createPortal(
    <div className={`fixed inset-0 z-[80] ${BG[prefs.bg]} text-ink`}>
      <div
        ref={scrollRef}
        dir={horizontal ? (rtl ? "rtl" : "ltr") : undefined}
        className={`absolute inset-0 overscroll-contain ${
          book ? "overflow-hidden" : horizontal ? "overflow-auto" : "overflow-y-auto"
        }`}
      >
        {loading ? (
          <ReaderLoading />
        ) : failed ? (
          <ReaderFailed onRetry={() => setReloadTick((t) => t + 1)} onExit={onExit} />
        ) : book && !complete ? (
          <div className="absolute inset-x-0 bottom-0 top-14">
            <BookFlip
              pages={pageUrls}
              rtl={rtl}
              bg={BG_HEX[prefs.bg]}
              resumePage={bookStart}
              soundEnabled={prefs.flipSound}
              zoom={prefs.zoom}
              onProgress={(p, sp) => {
                setCurrentPage(p);
                setBookSpread(sp);
                recordBookPage(p);
              }}
              onReady={(api) => {
                bookApi.current = api;
              }}
            />
          </div>
        ) : paged ? (
          <div
            className={`flex min-h-full justify-center px-4 py-3 ${double ? "items-center" : "items-start"}`}
            style={double ? { gap: `${prefs.doubleGap}px` } : undefined}
            onClick={(e) => {
              const x =
                (e.clientX - e.currentTarget.getBoundingClientRect().left) /
                e.currentTarget.clientWidth;
              if (x < 0.35) (rtl ? nextPage : prevPage)();
              else if (x > 0.65) (rtl ? prevPage : nextPage)();
            }}
          >
            {complete ? (
              <div className="flex min-h-[80vh] items-center justify-center">{completeCard}</div>
            ) : double ? (
              orderedSpread.map((i) => (
                <PageImage
                  key={i}
                  inline
                  url={pages[i]?.url ?? ""}
                  headers={pages[i]?.headers}
                  className="block"
                  style={dStyle}
                />
              ))
            ) : (
              <PageImage
                url={pages[displayPage]?.url ?? ""}
                headers={pages[displayPage]?.headers}
                className="mx-auto block"
                style={pStyle}
              />
            )}
          </div>
        ) : horizontal ? (
          <div className="flex h-full w-max min-w-full items-center">
            {pages.map((page, i) => (
              <div
                key={i}
                data-page={i}
                ref={(el) => {
                  pageEls.current[i] = el;
                }}
                className="h-full shrink-0"
              >
                <PageImage
                  url={page.url}
                  headers={page.headers}
                  fillHeight
                  className="block"
                  style={hStyle}
                />
              </div>
            ))}
            <div className="flex h-full w-[50vw] shrink-0 items-center justify-center px-16">
              {completeCard}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0 pb-28">
            {pages.map((page, i) => (
              <div
                key={i}
                data-page={i}
                ref={(el) => {
                  pageEls.current[i] = el;
                }}
                className="flex w-full justify-center"
              >
                <PageImage
                  url={page.url}
                  headers={page.headers}
                  className="mx-auto block"
                  style={longStyle}
                />
              </div>
            ))}
            <div className="flex w-full justify-center py-16">{completeCard}</div>
          </div>
        )}
      </div>

      {!loading && !failed && !complete && controlsVisible && (
        <ReaderNav
          pos={prefs.navPos}
          onPrev={book ? () => bookApi.current?.prev() : prevPage}
          onNext={
            book ? (bookAtEnd ? advanceFromBookEnd : () => bookApi.current?.next()) : nextPage
          }
        />
      )}

      {!loading && !failed && (
        <EndOfChapterHint
          visible={atChapterEnd && !prefs.hideChapterEndHint && !hintDismissed}
          atLastChapter={atLastChapter}
          nextLabel={nextIndex != null ? chapterLabel(chapters[nextIndex]) : undefined}
          onNext={() => nextIndex != null && onChangeIndex(nextIndex)}
          onDismiss={() => setHintDismissed(true)}
        />
      )}

      <div className="absolute inset-x-0 top-0 z-40">
        <ReaderBar
          visible={barVisible}
          chapters={chapters}
          index={index}
          onJumpChapter={onChangeIndex}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenSettings={() => setSettingsOpen((v) => !v)}
          onExit={onExit}
          flipSound={book ? prefs.flipSound : null}
          onToggleFlipSound={() => patchPrefs({ flipSound: !prefs.flipSound })}
        />
      </div>

      {settingsOpen && (
        <ReaderSettings
          prefs={prefs}
          onChange={(patch) => {
            if (patch.mode) setAutoLong(false);
            patchPrefs(patch);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {!disableMangaPersistence && controlsVisible && !loading && !failed && (
        <button
          type="button"
          onClick={() => setBookmarksOpen((v) => !v)}
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute end-6 top-[70px] z-[92] grid h-11 w-11 place-items-center rounded-full bg-canvas/85 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)] backdrop-blur-md transition duration-150 hover:text-accent active:scale-90 ${bookmarksOpen ? "text-accent" : "text-ink-muted"}`}
          aria-label={t("Bookmarks")}
        >
          <Bookmark size={19} />
        </button>
      )}

      {bookmarksOpen && (
        <BookmarksPanel
          mangaId={manga.id}
          current={bookmarkCurrent}
          canPick={(book || double) && spreadPages.length > 1}
          onPickPage={startPickBookmark}
          onJump={jumpBookmark}
          onClose={() => setBookmarksOpen(false)}
        />
      )}

      {pickBookmark && (
        <BookmarkPagePicker
          pages={spreadPages}
          onPick={bookmarkAtPage}
          onCancel={() => setPickBookmark(false)}
        />
      )}

      {!book && (
        <div className="absolute inset-x-0 bottom-0 z-40">
          <ReaderFooter
            visible={footerVisible}
            mode={effMode}
            currentPage={displayPage}
            totalPages={total}
            onScrubTo={goToPage}
            onPrevPage={prevPage}
            onNextPage={nextPage}
            atFirstChapter={atFirstChapter}
            atLastChapter={atLastChapter}
            onPrevChapter={() => prevIndex != null && onChangeIndex(prevIndex)}
            onNextChapter={() => nextIndex != null && onChangeIndex(nextIndex)}
            zoom={prefs.zoom}
            onZoom={(z) => patchPrefs({ zoom: z })}
          />
        </div>
      )}

      {!loading && !failed && controlsVisible && total > 0 && (
        <ReaderPageJump
          currentPage={displayPage}
          totalPages={total}
          label={book && bookSpread ? bookSpread : undefined}
          onJump={(n) => {
            if (book) {
              bookApi.current?.goToPage(n + 1);
              setCurrentPage(n);
            } else {
              goToPage(n);
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
}

function chapterLabel(c: MangaChapter): string {
  if (c.chapter) return t("Chapter {n}", { n: c.chapter });
  return c.title || t("Oneshot");
}
