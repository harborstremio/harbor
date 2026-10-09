import { ChevronLeft, ChevronRight, SkipBack, SkipForward, ZoomIn, ZoomOut } from "lucide-react";
import { Tooltip } from "@/views/detail/tooltip";
import { useT } from "@/lib/i18n";
import type { ReaderMode } from "@/views/manga/manga-reader/reader-types";

const SCRUB_CSS = `
.reader-scrub{-webkit-appearance:none;appearance:none;height:6px;border-radius:9999px;outline:none;cursor:pointer;}
.reader-scrub::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:15px;height:15px;border-radius:9999px;background:var(--color-accent);border:none;box-shadow:0 1px 5px rgba(0,0,0,0.4),0 0 0 4px rgba(255,255,255,0.06);transition:transform 130ms cubic-bezier(0.22,1,0.36,1);}
.reader-scrub:hover::-webkit-slider-thumb{transform:scale(1.15);}
.reader-scrub:active::-webkit-slider-thumb{transform:scale(1.28);}
.reader-scrub:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px;}
.reader-scrub:disabled{opacity:0.4;cursor:default;}
`;

const BTN =
  "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-ink-muted transition-all hover:bg-elevated hover:text-ink active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

const round1 = (n: number) => Math.round(n * 10) / 10;

function Btn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        onClick={onClick}
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        aria-label={label}
        className={BTN}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function ReaderFooter({
  visible,
  mode,
  currentPage,
  totalPages,
  onScrubTo,
  onPrevPage,
  onNextPage,
  atFirstChapter,
  atLastChapter,
  onPrevChapter,
  onNextChapter,
  zoom,
  onZoom,
}: {
  visible: boolean;
  mode: ReaderMode;
  currentPage: number;
  totalPages: number;
  onScrubTo: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  atFirstChapter: boolean;
  atLastChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  zoom: number;
  onZoom: (z: number) => void;
}) {
  const t = useT();
  const last = Math.max(0, totalPages - 1);
  const page = Math.min(Math.max(0, currentPage), last);
  const pct = last > 0 ? (page / last) * 100 : 0;
  const atStart = page <= 0 && atFirstChapter;
  const atEnd = page >= last && atLastChapter;
  const zoomPct = Math.round(zoom * 100);

  return (
    <footer
      data-mode={mode}
      className={`shrink-0 flex items-center gap-4 border-t border-edge-soft bg-canvas/70 px-4 py-3 text-ink backdrop-blur-xl transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <style>{SCRUB_CSS}</style>

      <div className="flex shrink-0 items-center gap-1">
        <Btn onClick={onPrevChapter} disabled={atFirstChapter} label={t("Previous chapter")}>
          <SkipBack className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </Btn>
        <Btn onClick={onPrevPage} disabled={atStart} label={t("Previous page")}>
          <ChevronLeft className="h-5 w-5" strokeWidth={2.2} />
        </Btn>
      </div>

      <div className="flex flex-1 items-center gap-3.5">
        <input
          type="range"
          min={0}
          max={last}
          value={page}
          disabled={last === 0}
          onChange={(e) => onScrubTo(Number(e.target.value))}
          aria-label={t("Page")}
          className="reader-scrub w-full"
          style={{
            background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-elevated) ${pct}%)`,
          }}
        />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
          {page + 1} / {Math.max(1, totalPages)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Btn onClick={onNextPage} disabled={atEnd} label={t("Next page")}>
          <ChevronRight className="h-5 w-5" strokeWidth={2.2} />
        </Btn>
        <Btn onClick={onNextChapter} disabled={atLastChapter} label={t("Next chapter")}>
          <SkipForward className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </Btn>

        <div className="ms-2 flex items-center gap-0.5 rounded-xl bg-elevated/50 p-0.5">
          <Btn
            onClick={() => onZoom(Math.max(0.5, round1(zoom - 0.1)))}
            disabled={zoom <= 0.5}
            label={t("Zoom out")}
          >
            <ZoomOut className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </Btn>
          <Tooltip label={t("Reset zoom")} side="top">
            <button
              type="button"
              onClick={() => onZoom(1)}
              onMouseDown={(e) => e.preventDefault()}
              aria-label={t("Reset zoom")}
              className="h-9 w-14 rounded-lg text-xs font-semibold tabular-nums text-ink-muted transition-all hover:bg-elevated hover:text-ink active:scale-95"
            >
              {zoomPct}%
            </button>
          </Tooltip>
          <Btn
            onClick={() => onZoom(Math.min(3, round1(zoom + 0.1)))}
            disabled={zoom >= 3}
            label={t("Zoom in")}
          >
            <ZoomIn className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </Btn>
        </div>
      </div>
    </footer>
  );
}
