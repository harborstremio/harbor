import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMobileRemote } from "../mobile-remote";
import { ReaderTopbar } from "./reader-topbar";
import { ReaderDock } from "./reader-dock";
import { ModeStrip } from "./mode-strip";
import { ModePaged } from "./mode-paged";
import { ModeBook } from "./mode-book";
import type { BookApi } from "@/views/manga/manga-reader/book-view";
import { useLocalPager } from "./hooks/use-local-pager";
import { loadLocalMode, loadLocalRtl, loadLocalZoom, loadStripPreview, mapDesktopMode, mapLocalToDesktopMode, saveLocalMode, saveLocalRtl, saveLocalZoom, saveStripPreview, type LocalMode } from "./local-reader-types";

export function MangaLocalReader({ onExit }: { onExit: () => void }) {
  const { snapshot, sendCommand } = useMobileRemote();
  const reduce = useReducedMotion();
  const t = useT();
  const m = snapshot.manga;

  const [mode, setMode] = useState<LocalMode>(() =>
    loadLocalMode(mapDesktopMode(m?.mode ?? "long")),
  );
  const [chromeHidden, setChromeHidden] = useState(false);
  const [showPreview, setShowPreview] = useState(loadStripPreview);
  const [localZoom, setLocalZoomState] = useState(() => (mode === "book" ? 1 : loadLocalZoom()));
  const [zoomFlash, setZoomFlash] = useState(false);
  const zoomFlashTimer = useRef(0);
  const zoomPct = Math.round(localZoom * 100);
  useEffect(() => {
    if (!chromeHidden) {
      setZoomFlash(false);
      window.clearTimeout(zoomFlashTimer.current);
      return;
    }
    setZoomFlash(true);
    window.clearTimeout(zoomFlashTimer.current);
    zoomFlashTimer.current = window.setTimeout(() => setZoomFlash(false), 1500);
    return () => window.clearTimeout(zoomFlashTimer.current);
  }, [zoomPct, chromeHidden]);
  const [bookSpread, setBookSpread] = useState("");
  const [bookStart, setBookStart] = useState(() => m?.pageIndex ?? 0);
  const bookApiLocal = useRef<BookApi | null>(null);

  const chapterId = m?.chapterId ?? "";
  const chapterIndex = m?.chapterIndex ?? 0;
  const chapterLabel = m?.chapterLabel ?? "";
  const [localRtl, setLocalRtl] = useState<boolean | null>(loadLocalRtl);
  const rtl = localRtl ?? m?.rtl ?? true;
  const hasPrev = m?.hasPrev ?? false;
  const hasNext = m?.hasNext ?? false;

  const rawPages = m?.pageUrls;
  const pages = useMemo(() => rawPages ?? [], [chapterId, rawPages?.length, rawPages?.[0]]);
  const total = pages.length || (m?.pageCount ?? 0);

  const { page, setPage } = useLocalPager(chapterId, total, m?.pageIndex ?? 0);

  const double = mode === "double";
  const step = double ? 2 : 1;
  const anchor = double ? page - (page % 2) : page;

  const firstChapter = useRef(true);
  const exitSeqSeen = useRef<number | null>(null);
  useEffect(() => {
    const seq = m?.exitLocalReader ?? 0;
    if (exitSeqSeen.current == null) {
      exitSeqSeen.current = seq;
      return;
    }
    if (seq !== exitSeqSeen.current) {
      exitSeqSeen.current = seq;
      onExit();
    }
  }, [m?.exitLocalReader, onExit]);
  useEffect(() => {
    sendCommand({ action: "mangaSetPagesHidden", hidden: !loadStripPreview() });
    return () => {
      sendCommand({ action: "mangaSetPagesHidden", hidden: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (firstChapter.current) {
      firstChapter.current = false;
      return;
    }
    setBookStart(0);
    setBookSpread("");
  }, [chapterId]);

  const prevMode = useRef(mode);
  useEffect(() => {
    if (mode === "book" && prevMode.current !== "book") {
      setBookStart(page);
      setLocalZoom(1);
    }
    prevMode.current = mode;
  }, [mode, page]);

  const desktopMapped = mapDesktopMode((m?.mode as any) ?? "long");
  const desktopModeRef = useRef(desktopMapped);
  useEffect(() => {
    if (desktopMapped === desktopModeRef.current) return;
    desktopModeRef.current = desktopMapped;
    setMode(desktopMapped);
    saveLocalMode(desktopMapped);
  }, [desktopMapped]);

  const reportRef = useRef({ page: -1, frac: -1 });
  const reportStripPage = (page: number, scroll?: number, vel?: number) => {
    setPage(page);
    const last = reportRef.current;
    const frac =
      scroll == null
        ? page === last.page
          ? last.frac
          : 0
        : Math.max(0, Math.min(1, Math.round(scroll * 1000) / 1000));
    const v = vel == null || !Number.isFinite(vel) ? 0 : Math.round(vel * 100000) / 100000;
    if (page === last.page && frac === last.frac) return;
    reportRef.current = { page, frac };
    sendCommand(
      scroll == null
        ? { action: "mangaSetPage", page }
        : { action: "mangaSetPage", page, scroll: frac, vel: v },
    );
  };

  const pageLabel = useMemo(() => {
    if (total <= 0) return "";
    if (mode === "book" && bookSpread) return `${bookSpread} / ${total}`;
    if (double) {
      const lo = anchor + 1;
      const hi = Math.min(anchor + 2, total);
      return hi > lo ? `${lo}-${hi} / ${total}` : `${lo} / ${total}`;
    }
    return `${Math.min(page + 1, total)} / ${total}`;
  }, [mode, bookSpread, double, anchor, page, total]);

  if (!m || !m.open) return null;

  const jumpChapter = (index: number) => sendCommand({ action: "mangaJumpChapter", index });

  const turn = (dir: "next" | "prev") => {
    if (dir === "next") {
      const target = anchor + step;
      if (target < total) reportStripPage(target);
      else if (hasNext) jumpChapter(chapterIndex + 1);
    } else {
      const target = anchor - step;
      if (target >= 0) reportStripPage(target);
      else if (hasPrev) jumpChapter(chapterIndex - 1);
    }
  };

  const pickMode = (next: LocalMode) => {
    setMode(next);
    saveLocalMode(next);
    sendCommand({ action: "mangaSetMode", mode: mapLocalToDesktopMode(next) });
    setLocalZoom(1);
    if (next === "double") reportStripPage(page - (page % 2));
  };

  const togglePreview = (next: boolean) => {
    setShowPreview(next);
    saveStripPreview(next);
    sendCommand({ action: "mangaSetPagesHidden", hidden: !next });
  };

  const toggleDirection = () => {
    const next = !rtl;
    setLocalRtl(next);
    saveLocalRtl(next);
    sendCommand({ action: "mangaSetRtl", rtl: next });
  };

  const handleExit = () => {
    setShowPreview(true);
    saveStripPreview(true);
    sendCommand({ action: "mangaSetPagesHidden", hidden: false });
    onExit();
  };

  const setLocalZoom = (z: number) => {
    const clamped = Math.max(0.5, Math.min(3, Math.round(z * 100) / 100));
    setLocalZoomState(clamped);
    saveLocalZoom(clamped);
  };

  const toggleChrome = () => setChromeHidden((v) => !v);
  const chromeVisible = !chromeHidden;
  const chromeCls = `${reduce ? "" : "transition-opacity duration-200 motion-reduce:transition-none "}${
    chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
  const zoomBadgeVisible = (chromeVisible && zoomPct !== 100) || zoomFlash;
  const waiting = pages.length === 0;

  return (
    <div className="fixed inset-0 z-[70] select-none overflow-hidden bg-[#0b0b0d] text-ink">
      <div className="absolute inset-0">
        {waiting ? (
          <div className="grid h-full w-full place-items-center">
            <div className="flex flex-col items-center gap-3 text-ink-subtle">
              <span className="h-8 w-8 rounded-full border-2 border-edge-soft border-t-accent animate-spin motion-reduce:animate-none" />
              <span className="text-[13px] font-medium">{t("Loading chapter")}</span>
            </div>
          </div>
        ) : mode === "strip" || mode === "strip-h" ? (
          <ModeStrip
            pages={pages}
            initialPage={page}
            onPageChange={(p, f) => reportStripPage(p, f)}
            onScrollState={(p, f, v) => reportStripPage(p, f, v)}
            onToggleChrome={toggleChrome}
            direction={mode === "strip-h" ? "horizontal" : "vertical"}
            rtl={rtl}
            zoom={localZoom}
            applyZoom
            onZoom={setLocalZoom}
          />
        ) : mode === "book" ? (
          <ModeBook
            pages={pages}
            rtl={rtl}
            resumePage={bookStart}
            zoom={localZoom}
            onZoom={setLocalZoom}
            onToggleChrome={toggleChrome}
            onProgress={(p, sp) => {
              reportStripPage(p);
              setBookSpread(sp);
            }}
            onTurn={(dir) => {
              if (dir === "next") bookApiLocal.current?.next();
              else bookApiLocal.current?.prev();
            }}
            onReady={(api) => {
              bookApiLocal.current = api;
            }}
          />
        ) : (
          <ModePaged
            pages={pages}
            anchor={anchor}
            total={total}
            rtl={rtl}
            double={double}
            onTurn={turn}
            onToggleChrome={toggleChrome}
            zoom={localZoom}
            onZoom={setLocalZoom}
          />
        )}
      </div>

      <div className={`absolute inset-x-0 top-0 z-20 ${chromeCls}`}>
        <ReaderTopbar
          chapterLabel={chapterLabel}
          pageLabel={pageLabel}
          mode={mode}
          reduce={reduce}
          showPreview={showPreview}
          rtl={rtl}
          onExit={handleExit}
          onPickMode={pickMode}
          onTogglePreview={togglePreview}
          onToggleDirection={toggleDirection}
        />
      </div>

      <div className={`absolute inset-x-0 bottom-0 z-20 ${chromeCls}`}>
        <ReaderDock
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={() => jumpChapter(chapterIndex - 1)}
          onNext={() => jumpChapter(chapterIndex + 1)}
        />
      </div>

      <button
        type="button"
        aria-label={t("Reset zoom")}
        onClick={() => setLocalZoom(1)}
        className={`absolute end-4 z-20 rounded-full bg-elevated/70 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ring-1 ring-edge-soft/50 backdrop-blur-xl transition-opacity duration-200 motion-reduce:transition-none ${
          zoomBadgeVisible ? "text-ink opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
      >
        {zoomPct}%
      </button>
    </div>
  );
}
