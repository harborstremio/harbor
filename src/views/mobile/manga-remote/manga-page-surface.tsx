import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useMangaGestures, type MangaGestureInput } from "./use-manga-gestures";

type Props = {
  chapterLabel: string;
  displayPage: number;
  pageCount: number;
  spreadLabel?: string;
  gestures: MangaGestureInput;
};

export function MangaPageSurface({
  chapterLabel,
  displayPage,
  pageCount,
  spreadLabel,
  gestures,
}: Props) {
  const t = useT();
  const { surfaceRef, visual, handlers } = useMangaGestures(gestures);
  const total = Math.max(1, pageCount);
  const bigLabel = spreadLabel || String(Math.min(displayPage + 1, total));
  const atStart = displayPage <= 0 && !gestures.canPrev;
  const atEnd = displayPage >= pageCount - 1 && !gestures.canNext;

  return (
    <div
      ref={surfaceRef}
      {...handlers}
      className="relative min-h-0 flex-1 select-none overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <div
          className="relative flex aspect-[2/3] w-[min(78%,320px)] flex-col items-center justify-center gap-2.5 rounded-[22px] border border-edge-soft/70 bg-elevated shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]"
          style={{ transform: `translate3d(${visual.tx}px, 0, 0) scale(${visual.scale})` }}
        >
          <span className="absolute inset-x-4 top-4 h-px bg-edge-soft/50" />
          <span className="max-w-[80%] truncate text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {chapterLabel}
          </span>
          <span
            className={`font-display leading-none tabular-nums text-ink ${spreadLabel ? "text-[52px]" : "text-[72px]"}`}
          >
            {bigLabel}
          </span>
          <span className="text-[13px] tabular-nums text-ink-subtle">
            {t("of {total}", { total })}
          </span>
          <span className="absolute inset-x-4 bottom-4 h-px bg-edge-soft/50" />
        </div>
      </div>

      {visual.hintDir && !gestures.reduce && (
        <div
          className={`pointer-events-none absolute inset-y-0 flex items-center ${visual.hintDir === "next" ? "end-5" : "start-5"}`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">
            {visual.hintDir === "next" ? (
              <ChevronRight size={26} strokeWidth={2.6} />
            ) : (
              <ChevronLeft size={26} strokeWidth={2.6} />
            )}
          </span>
        </div>
      )}

      {(atStart || atEnd) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <span className="rounded-full bg-surface/90 px-4 py-1.5 text-[12.5px] font-medium text-ink-muted backdrop-blur">
            {atStart ? t("Start of manga") : t("End of manga")}
          </span>
        </div>
      )}
    </div>
  );
}
