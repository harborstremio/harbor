import { lazy, Suspense, useRef, useState } from "react";
import {
  Bookmark,
  BookOpen,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Minus,
  Monitor,
  Plus,
  X,
} from "lucide-react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMobileRemote } from "../mobile-remote";
import { RendererSheet } from "../renderer-sheet";
import { MangaPageSurface } from "./manga-page-surface";
import { MangaRemoteEmpty } from "./manga-remote-empty";
import { ZoomJoystick } from "./zoom-joystick";
import { useOptimisticPage } from "./use-optimistic-page";
import { useHistoryBackGuard } from "./use-history-guard";
import { clampZoom, ZOOM_MAX, ZOOM_MIN, type TurnDir } from "./gesture-math";

const ChapterNavigator = lazy(() =>
  import("./chapter-navigator").then((m) => ({ default: m.ChapterNavigator })),
);
const PageJumpSheet = lazy(() =>
  import("./page-jump-sheet").then((m) => ({ default: m.PageJumpSheet })),
);
const BookmarksSheet = lazy(() =>
  import("./bookmarks-sheet").then((m) => ({ default: m.BookmarksSheet })),
);

export function MangaRemote({
  standalone = false,
  onReadHere,
}: {
  standalone?: boolean;
  onReadHere?: () => void;
}) {
  const { connected, snapshot, sendCommand } = useMobileRemote();
  const reduce = useReducedMotion();
  const m = snapshot.manga;

  const [deviceOpen, setDeviceOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [pageJumpOpen, setPageJumpOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [zoomEngaged, setZoomEngaged] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef(0);

  useHistoryBackGuard(true);

  const count = m?.pageCount ?? 0;
  const { displayPage, advance } = useOptimisticPage(
    m?.pageIndex ?? 0,
    count,
    m?.chapterId ?? "",
    m?.seq ?? 0,
  );

  if (!m || !m.open) return <MangaRemoteEmpty variant="closed" />;

  const flash = (text: string) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 1600);
  };

  const turn = (dir: TurnDir) => {
    const sent = sendCommand({ action: "mangaTurnPage", dir });
    if (sent) advance(dir);
    else flash("Reconnecting to your computer");
  };
  const flipProgress = (p: number) => {
    sendCommand({ action: "mangaFlipProgress", p });
  };
  const flipEnd = (commit: boolean, dir: TurnDir) => {
    const sent = sendCommand({ action: "mangaFlipEnd", commit, dir });
    if (commit && sent) advance(dir);
    else if (!sent) flash("Reconnecting to your computer");
  };
  const zoomAbs = (z: number) => sendCommand({ action: "mangaSetZoom", zoom: clampZoom(z) });
  const zoomStep = (dir: "in" | "out") =>
    sendCommand({ action: dir === "in" ? "mangaZoomIn" : "mangaZoomOut" });
  const pan = (dx: number, dy: number) => sendCommand({ action: "mangaPan", dx, dy });

  const chromeCls = `${reduce ? "" : "transition-opacity duration-200 "}${chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"}`;
  const total = Math.max(1, count);
  const spreadNums = (m.spread ?? []).filter((n) => n > 0);
  const isSpread = (m.mode === "book" || m.mode === "double") && spreadNums.length >= 2;
  const spreadLabel = isSpread ? `${Math.min(...spreadNums)}-${Math.max(...spreadNums)}` : "";
  const chipPage = isSpread ? spreadLabel : String(Math.min(displayPage + 1, total));

  return (
    <>
      <div
        className="relative flex h-full touch-none select-none flex-col"
        style={{
          paddingBottom: standalone
            ? "calc(env(safe-area-inset-bottom, 0px) + 16px)"
            : "calc(env(safe-area-inset-bottom, 0px) + 92px)",
        }}
      >
        <div className={`flex items-center gap-2 px-3 pt-3 ${chromeCls}`}>
          <button
            type="button"
            aria-label="Close reader"
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
              {connected ? snapshot.target.label || "Your computer" : "Reconnecting"}
            </span>
            <ChevronDown size={14} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
          </button>
          {onReadHere && (
            <button
              type="button"
              onClick={onReadHere}
              aria-label="Read on this device"
              className="ms-auto flex h-11 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-canvas transition-transform active:scale-95"
            >
              <BookOpen size={15} strokeWidth={2.4} /> Read here
            </button>
          )}
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
          gestures={{
            rtl: m.rtl,
            canPrev: m.pageIndex > 0 || m.hasPrev,
            canNext: m.pageIndex < count - 1 || m.hasNext,
            zoom: m.zoom,
            canZoom: m.canZoom,
            reduce,
            onTurn: turn,
            onZoom: zoomAbs,
            onToggleChrome: () => setChromeHidden((v) => !v),
            progressive: m.mode === "book",
            onDrag: flipProgress,
            onDragEnd: flipEnd,
          }}
        />

        <div
          className={`flex items-center justify-center gap-2 px-4 ${chromeCls} ${zoomEngaged ? "pointer-events-none opacity-0" : ""}`}
        >
          <DockButton
            label="Previous chapter"
            disabled={!m.hasPrev}
            onPress={() => sendCommand({ action: "mangaJumpChapter", index: m.chapterIndex - 1 })}
          >
            <ChevronsLeft size={24} strokeWidth={2.2} />
          </DockButton>
          {m.canZoom && (
            <DockButton label="Zoom out" onPress={() => zoomStep("out")}>
              <Minus size={22} strokeWidth={2.4} />
            </DockButton>
          )}
          {m.canZoom && (
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => zoomAbs(1)}
              className="grid h-11 min-w-[54px] place-items-center rounded-full bg-elevated/60 px-3 text-[13px] font-semibold tabular-nums text-ink ring-1 ring-edge-soft/50 transition-transform active:scale-95"
            >
              {Math.round(m.zoom * 100)}%
            </button>
          )}
          <DockButton label="Bookmarks" accent onPress={() => setBookmarksOpen(true)}>
            <Bookmark size={26} strokeWidth={2.2} />
          </DockButton>
          {m.canZoom && (
            <DockButton label="Zoom in" onPress={() => zoomStep("in")}>
              <Plus size={22} strokeWidth={2.4} />
            </DockButton>
          )}
          <DockButton
            label="Next chapter"
            disabled={!m.hasNext}
            onPress={() => sendCommand({ action: "mangaJumpChapter", index: m.chapterIndex + 1 })}
          >
            <ChevronsRight size={24} strokeWidth={2.2} />
          </DockButton>
        </div>

        <ZoomJoystick
          zoom={m.zoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          canZoom={m.canZoom}
          onZoom={zoomAbs}
          onPan={pan}
          onEngageChange={setZoomEngaged}
          bottomOffset="calc(env(safe-area-inset-bottom, 0px) + 84px)"
        />
      </div>

      {!connected && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <span className="rounded-full bg-surface/90 px-4 py-2 text-[13px] font-semibold text-ink-muted backdrop-blur-xl">
            Reconnecting to your computer
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

      <RendererSheet open={deviceOpen} onClose={() => setDeviceOpen(false)} title="Read on" />
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
