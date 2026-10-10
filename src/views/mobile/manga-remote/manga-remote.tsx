import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  GalleryHorizontal,
  Monitor,
  MousePointerClick,
  MoveHorizontal,
  MoveVertical,
  Settings,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMobileRemote } from "../mobile-remote";
import { RendererSheet } from "../renderer-sheet";
import { MangaPageSurface } from "./manga-page-surface";
import { MangaRemoteEmpty } from "./manga-remote-empty";
import { useOptimisticPage } from "./use-optimistic-page";
import { useRemoteLayout, useStripPreview, type RemoteLayout } from "./use-remote-layout";
import { useHistoryBackGuard } from "./use-history-guard";
import { clampZoom, type TurnDir } from "./gesture-math";

const ChapterNavigator = lazy(() =>
  import("./chapter-navigator").then((m) => ({ default: m.ChapterNavigator })),
);
const PageJumpSheet = lazy(() =>
  import("./page-jump-sheet").then((m) => ({ default: m.PageJumpSheet })),
);
const BookmarksSheet = lazy(() =>
  import("./bookmarks-sheet").then((m) => ({ default: m.BookmarksSheet })),
);
const MangaSettingsSheet = lazy(() =>
  import("./manga-settings-sheet").then((m) => ({ default: m.MangaSettingsSheet })),
);

function TapPagesIcon({ size = 18, double = false }: { size?: number; double?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="7.5" height="16" rx="1.5" fill="currentColor" stroke="none" />
      <rect
        x="13.5"
        y="4"
        width="7.5"
        height="16"
        rx="1.5"
        fill="currentColor"
        stroke="none"
        opacity={double ? 1 : 0.35}
      />
    </svg>
  );
}

export function MangaRemote({
  standalone = false,
  onReadHere,
}: {
  standalone?: boolean;
  onReadHere?: () => void;
}) {
  const { connected, snapshot, sendCommand } = useMobileRemote();
  const reduce = useReducedMotion();
  const t = useT();
  const m = snapshot.manga;

  const [deviceOpen, setDeviceOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef(0);
  const [zoomFlash, setZoomFlash] = useState(false);
  const zoomFlashTimer = useRef(0);
  const panRaf = useRef(0);
  const panAcc = useRef({ x: 0, y: 0 });
  const zoomRaf = useRef(0);
  const zoomPending = useRef<number | null>(null);
  const zoomPct = m ? Math.round(m.zoom * 100) : 100;
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
  useEffect(
    () => () => {
      if (panRaf.current) cancelAnimationFrame(panRaf.current);
      panRaf.current = 0;
      if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current);
      zoomRaf.current = 0;
    },
    [],
  );
  const [layout, setLayout] = useRemoteLayout();
  const [showPreview, setShowPreview] = useStripPreview();
  const prevMode = useRef<string | null>(null);
  useEffect(() => {
    const mode: string | undefined = m?.mode;
    if (!mode || mode === prevMode.current) return;
    prevMode.current = mode;
    const mapped: RemoteLayout =
      mode === "long"
        ? "strip"
        : mode === "long-h"
          ? "strip-h"
          : mode === "paged" || mode === "double"
            ? "tap"
            : "swipe";
    setLayout(mapped);
  }, [m?.mode, setLayout]);
  const [feedPage, setFeedPage] = useState<number | null>(null);
  const feedState = useRef({ page: -1, frac: -1, t: 0, seq: -1 });
  useEffect(() => {
    setFeedPage(null);
    feedState.current = { page: -1, frac: -1, t: 0, seq: -1 };
  }, [m?.chapterId]);

  useHistoryBackGuard(true);

  const count = m?.pageCount ?? 0;
  const { displayPage, advance } = useOptimisticPage(
    m?.pageIndex ?? 0,
    count,
    m?.chapterId ?? "",
    m?.seq ?? 0,
  );
  const feedUrls = useMemo(() => m?.pageUrls ?? [], [m?.chapterId, m?.pageCount]);

  useEffect(() => {
    if (feedPage == null || displayPage === feedPage) return;
    if ((m?.seq ?? -1) === feedState.current.seq) return;
    if (performance.now() - feedState.current.t < 500) return;
    setFeedPage(null);
  }, [displayPage, feedPage, m?.seq]);

  if (!m || !m.open) return <MangaRemoteEmpty variant="closed" />;

  const flash = (text: string) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1600);
  };

  const LAYOUTS: Array<{ id: RemoteLayout; label: string; Icon: typeof MoveHorizontal }> = [
    { id: "swipe", label: t("Swipe sideways"), Icon: MoveHorizontal },
    { id: "strip", label: t("Long strip"), Icon: MoveVertical },
    { id: "strip-h", label: t("Horizontal strip"), Icon: GalleryHorizontal },
    { id: "tap", label: t("Tap sides to turn"), Icon: MousePointerClick },
  ];
  const isDouble = m?.mode === "double";
  const turn = (dir: TurnDir) => {
    const sent = sendCommand({ action: "mangaTurnPage", dir });
    if (sent) advance(dir);
    else flash(t("Reconnecting to your computer"));
  };
  const reportFeedPage = (page: number, scroll?: number, vel?: number) => {
    setFeedPage(page);
    const last = feedState.current;
    const frac =
      scroll == null
        ? page === last.page
          ? last.frac
          : 0.5
        : Math.max(0, Math.min(1, Math.round(scroll * 1000) / 1000));
    const v = vel == null || !Number.isFinite(vel) ? 0 : Math.round(vel * 100000) / 100000;
    if (page === last.page && frac === last.frac) return;
    feedState.current = { page, frac, t: performance.now(), seq: m?.seq ?? -1 };
    sendCommand(
      scroll == null
        ? { action: "mangaSetPage", page }
        : { action: "mangaSetPage", page, scroll: frac, vel: v },
    );
  };
  const flipProgress = (p: number) => {
    sendCommand({ action: "mangaFlipProgress", p });
  };
  const flipEnd = (commit: boolean, dir: TurnDir) => {
    const sent = sendCommand({ action: "mangaFlipEnd", commit, dir });
    if (commit && sent) advance(dir);
    else if (!sent) flash(t("Reconnecting to your computer"));
  };
  const zoomAbs = (z: number) => {
    zoomPending.current = clampZoom(z);
    if (zoomRaf.current) return;
    zoomRaf.current = requestAnimationFrame(() => {
      zoomRaf.current = 0;
      const next = zoomPending.current;
      zoomPending.current = null;
      if (next != null) sendCommand({ action: "mangaSetZoom", zoom: next });
    });
  };
  const sendPan = (dx: number, dy: number) => {
    const acc = panAcc.current;
    acc.x += dx;
    acc.y += dy;
    if (panRaf.current) return;
    panRaf.current = requestAnimationFrame(() => {
      panRaf.current = 0;
      const x = acc.x;
      const y = acc.y;
      acc.x = 0;
      acc.y = 0;
      if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;
      sendCommand({ action: "mangaPan", dx: x, dy: y });
    });
  };
  const chromeCls = `${reduce ? "" : "transition-opacity duration-200 "}${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`;
  const chromeVisible = !chromeHidden;
  const zoomBadgeVisible = (chromeVisible && zoomPct !== 100) || zoomFlash;
  const total = Math.max(1, count);
  const spreadNums = (m.spread ?? []).filter((n) => n > 0);
  const isSpread = (m.mode === "book" || m.mode === "double") && spreadNums.length >= 2;
  const spreadLabel = isSpread ? `${Math.min(...spreadNums)}-${Math.max(...spreadNums)}` : "";
  const chipPage =
    (layout === "strip" || layout === "strip-h") && feedPage != null
      ? String(Math.min(feedPage + 1, total))
      : isSpread
        ? spreadLabel
        : String(Math.min(displayPage + 1, total));

  return (
    <>
      <div
        className={`relative flex h-full select-none flex-col ${layout === "strip" ? "[touch-action:pan-y]" : layout === "strip-h" ? "[touch-action:pan-x]" : "touch-none"}`}
        style={{
          paddingBottom: standalone
            ? "calc(env(safe-area-inset-bottom, 0px) + 16px)"
            : "calc(env(safe-area-inset-bottom, 0px) + 92px)",
        }}
      >
        <div className={`flex items-center gap-2 px-3 pt-3 ${chromeCls}`}>
          <button
            type="button"
            aria-label={t("Close reader")}
            onClick={() => sendCommand({ action: "mangaCloseReader" })}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-transform active:scale-90"
          >
            <X size={22} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setDeviceOpen(true)}
            className="flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 transition-opacity active:opacity-60"
          >
            <Monitor
              size={15}
              strokeWidth={2.2}
              className={connected ? "text-ink" : "text-ink-subtle"}
            />
            <span className="truncate text-[13px] font-semibold text-ink">
              {connected ? snapshot.target.label || t("Your computer") : t("Reconnecting")}
            </span>
            <ChevronDown size={14} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
          </button>
          {onReadHere && (
            <button
              type="button"
              onClick={onReadHere}
              aria-label={t("Read on this device")}
              className="ms-auto flex h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-canvas transition-transform active:scale-95"
            >
              <BookOpen size={15} strokeWidth={2.4} /> {t("Read here")}
            </button>
          )}
          {!onReadHere && <span className="ms-auto" />}
          <button
            type="button"
            aria-label={t("Bookmarks")}
            onClick={() => setBookmarksOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-transform active:scale-90"
          >
            <Bookmark size={20} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label={t("Reader settings")}
            onClick={() => setSettingsOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-muted transition-transform active:scale-90"
          >
            <Settings size={20} strokeWidth={2.2} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setChaptersOpen(true)}
          className={`mx-auto mt-3.5 flex max-w-[86%] items-center gap-2 rounded-full bg-elevated/70 px-4 py-1.5 transition-transform active:scale-95 ${chromeCls}`}
        >
          <span className="truncate text-[13.5px] font-semibold text-ink">{m.chapterLabel}</span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-ink-subtle">
            {chipPage} / {total}
          </span>
        </button>

        <MangaPageSurface
          chapterLabel={m.chapterLabel}
          displayPage={displayPage}
          pageCount={count}
          spreadLabel={spreadLabel || undefined}
          layout={layout}
          pageUrls={feedUrls}
          initialPage={feedPage ?? displayPage}
          rtl={m.rtl}
          showPreview={showPreview}
          onPageVisible={reportFeedPage}
          gestures={{
            rtl: m.rtl,
            canPrev: m.pageIndex > 0 || m.hasPrev,
            canNext: m.pageIndex < count - 1 || m.hasNext,
            zoom: m.zoom,
            canZoom: m.canZoom,
            reduce,
            axis: layout === "strip" ? "y" : "x",
            tapZones: layout === "tap",
            onTurn: turn,
            onZoom: zoomAbs,
            onPan: sendPan,
            onToggleChrome: () => setChromeHidden((v) => !v),
            progressive: layout === "swipe" && m.mode === "book",
            onDrag: flipProgress,
            onDragEnd: flipEnd,
          }}
        />

        <div
          className={`flex items-center justify-center gap-2 px-4 ${chromeCls}`}
        >
          <DockButton
            label={t("Previous chapter")}
            disabled={!m.hasPrev}
            onPress={() => sendCommand({ action: "mangaJumpChapter", index: m.chapterIndex - 1 })}
          >
            <ChevronsLeft size={24} strokeWidth={2.2} />
          </DockButton>
          <div
            role="group"
            aria-label={t("Control layout")}
            className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-elevated/60 p-1 ring-1 ring-edge-soft/50"
          >
            {LAYOUTS.map(({ id, label, Icon }) => {
              const active = layout === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={active}
                  onClick={() => {
                    setLayout(id);
                    flash(label);
                    const desktop = m.mode;
                    if (id === "strip" && desktop !== "long") {
                      sendCommand({ action: "mangaSetMode", mode: "long" });
                    } else if (id === "strip-h" && desktop !== "long-h") {
                      sendCommand({ action: "mangaSetMode", mode: "long-h" });
                    } else if (id === "tap") {
                      sendCommand({
                        action: "mangaSetMode",
                        mode: desktop === "paged" ? "double" : "paged",
                      });
                    } else if (id === "swipe" && desktop !== "book") {
                      sendCommand({ action: "mangaSetMode", mode: "book" });
                    }
                  }}
                  className={`grid h-10 min-w-0 flex-1 place-items-center rounded-full transition-transform active:scale-90 ${
                    active ? "bg-accent text-canvas" : "text-ink-muted"
                  }`}
                >
                  {id === "tap" ? (
                    <TapPagesIcon size={18} double={isDouble} />
                  ) : (
                    <Icon size={18} strokeWidth={2.2} />
                  )}
                </button>
              );
            })}
          </div>
          <DockButton
            label={t("Next chapter")}
            disabled={!m.hasNext}
            onPress={() => sendCommand({ action: "mangaJumpChapter", index: m.chapterIndex + 1 })}
          >
            <ChevronsRight size={24} strokeWidth={2.2} />
          </DockButton>
        </div>

        {m.canZoom && (
          <button
            type="button"
            aria-label={t("Reset zoom")}
            onClick={() => zoomAbs(1)}
            className={`absolute end-4 z-40 rounded-full bg-elevated/70 px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ring-1 ring-edge-soft/50 backdrop-blur-xl transition-opacity duration-200 motion-reduce:transition-none ${
              zoomBadgeVisible ? "text-ink opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
          >
            {zoomPct}%
          </button>
        )}
      </div>

      {!connected && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <span className="rounded-full bg-surface/90 px-4 py-2 text-[13px] font-semibold text-ink-muted backdrop-blur-xl">
            {t("Reconnecting to your computer")}
          </span>
        </div>
      )}
      {hint && connected && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <span className="rounded-full bg-danger/90 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-xl">
            {hint}
          </span>
        </div>
      )}

      <RendererSheet open={deviceOpen} onClose={() => setDeviceOpen(false)} title={t("Read on")} />
      <Suspense fallback={null}>
        {chaptersOpen && (
          <ChapterNavigator
            open={chaptersOpen}
            onClose={() => setChaptersOpen(false)}
            onJumpPage={() => {
              setChaptersOpen(false);
              setPageJumpOpen(true);
            }}
          />
        )}
        {pageJumpOpen && (
          <PageJumpSheet open={pageJumpOpen} onClose={() => setPageJumpOpen(false)} />
        )}
        {bookmarksOpen && (
          <BookmarksSheet open={bookmarksOpen} onClose={() => setBookmarksOpen(false)} />
        )}
        {settingsOpen && (
          <MangaSettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            showPreview={showPreview}
            onTogglePreview={setShowPreview}
          />
        )}
      </Suspense>
    </>
  );
}

function DockButton({
  label,
  onPress,
  disabled,
  accent,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={`grid shrink-0 place-items-center rounded-full transition-transform duration-100 active:scale-90 disabled:opacity-30 disabled:active:scale-100 ${
        accent
          ? "h-16 w-16 bg-accent text-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.55)]"
          : "h-[54px] w-[54px] bg-elevated/60 text-ink ring-1 ring-edge-soft/50"
      }`}
    >
      {children}
    </button>
  );
}
