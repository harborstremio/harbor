import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMobileRemote } from "../mobile-remote";
import { ReaderTopbar } from "./reader-topbar";
import { ReaderDock } from "./reader-dock";
import { ModeStrip } from "./mode-strip";
import { ModePaged } from "./mode-paged";
import { ModeBook } from "./mode-book";
import { useLocalPager } from "./hooks/use-local-pager";
import { loadLocalMode, mapDesktopMode, saveLocalMode, type LocalMode } from "./local-reader-types";

export function MangaLocalReader({ onExit }: { onExit: () => void }) {
  const { snapshot, sendCommand } = useMobileRemote();
  const reduce = useReducedMotion();
  const t = useT();
  const m = snapshot.manga;

  const [mode, setMode] = useState<LocalMode>(() =>
    loadLocalMode(mapDesktopMode(m?.mode ?? "long")),
  );
  const [chromeHidden, setChromeHidden] = useState(false);
  const [bookSpread, setBookSpread] = useState("");
  const [bookStart, setBookStart] = useState(() => m?.pageIndex ?? 0);

  const chapterId = m?.chapterId ?? "";
  const chapterIndex = m?.chapterIndex ?? 0;
  const chapterLabel = m?.chapterLabel ?? "";
  const rtl = m?.rtl ?? true;
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
    if (mode === "book" && prevMode.current !== "book") setBookStart(page);
    prevMode.current = mode;
  }, [mode, page]);

  const lastSent = useRef(m?.pageIndex ?? 0);
  useEffect(() => {
    if (page === lastSent.current) return;
    const id = window.setTimeout(() => {
      lastSent.current = page;
      sendCommand({ action: "mangaSetPage", page });
    }, 450);
    return () => window.clearTimeout(id);
  }, [page, sendCommand]);

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
      if (target < total) setPage(target);
      else if (hasNext) jumpChapter(chapterIndex + 1);
    } else {
      const target = anchor - step;
      if (target >= 0) setPage(target);
      else if (hasPrev) jumpChapter(chapterIndex - 1);
    }
  };

  const pickMode = (next: LocalMode) => {
    setMode(next);
    saveLocalMode(next);
    if (next === "double") setPage(page - (page % 2));
  };

  const toggleChrome = () => setChromeHidden((v) => !v);
  const chromeVisible = mode === "book" || !chromeHidden;
  const chromeCls = `${reduce ? "" : "transition-opacity duration-200 motion-reduce:transition-none "}${
    chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
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
        ) : mode === "strip" ? (
          <ModeStrip
            pages={pages}
            initialPage={page}
            onPageChange={setPage}
            onToggleChrome={toggleChrome}
          />
        ) : mode === "book" ? (
          <ModeBook
            pages={pages}
            rtl={rtl}
            resumePage={bookStart}
            onProgress={(p, sp) => {
              setPage(p);
              setBookSpread(sp);
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
          />
        )}
      </div>

      <div className={`absolute inset-x-0 top-0 z-20 ${chromeCls}`}>
        <ReaderTopbar
          chapterLabel={chapterLabel}
          pageLabel={pageLabel}
          mode={mode}
          reduce={reduce}
          onExit={onExit}
          onPickMode={pickMode}
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
    </div>
  );
}
