import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTimeLabel } from "@/views/live/guide/guide-utils";
import { MIN_CELL_PX, type GuideMetrics } from "./bp-guide-geometry";
import type { BpGuideCell } from "./bp-guide-lane";
import { bpSameText } from "./bp-guide-title";
import { subscribeBpTick } from "./bp-live-tick";

const NARROW_PX = 44;
const FULL_PX = 150;

// The separation between two programmes is bought entirely out of width on the
// inline-end. left stays exact, never floored and never offset, which is what
// keeps a two hour film exactly four half hour slots wide and every block
// sitting on its real start time. Unscheduled cells keep their exact width so a
// run of slices butts seamlessly, and they paint nothing so the butt is
// invisible. MIN_CELL_PX is only a floor for a degenerate sub-second gap.
const BLOCK_INSET_Y_PX = 10;
const BLOCK_GUTTER_PX = 10;
const MIN_BLOCK_PX = 24;

const SHELL =
  "absolute flex flex-col justify-center gap-[3px] overflow-hidden rounded-[var(--bp-r-xs)] text-start transition-[background-color,box-shadow,opacity] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]";

const FUTURE = "border border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)] text-ink-subtle";

const AIRING =
  "border border-[color-mix(in_oklab,var(--bp-live)_45%,transparent)] bg-[color-mix(in_oklab,var(--bp-live)_14%,var(--bp-panel-2))] text-ink-muted";

// Dimming is a programme state, never a lane state. Applying it to gaps put a
// hard vertical seam through an empty band wherever two slices straddled now.
const PAST =
  "border border-[var(--bp-edge)] bg-[color-mix(in_oklab,var(--bp-panel-2)_45%,transparent)] text-ink-subtle opacity-[0.55]";

// A time-aligned cell must not scale, or the grid lies about when a programme
// starts, and a dwell delay on a cursor that is the reading position lags the
// eye. The lane viewport is overflow-hidden, so the ring has to be inset:
// the outset tile ring from bp-tokens would be clipped by the row box.
const RING =
  "data-[bp-focus=true]:z-[3] data-[bp-focus=true]:opacity-100 data-[bp-focus=true]:bg-[var(--bp-focus-face)] data-[bp-focus=true]:text-ink data-[bp-focus=true]:shadow-[inset_0_0_0_2px_var(--bp-focus-stroke)]";

function BlockProgress({ startMs, endMs }: { startMs: number; endMs: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const span = endMs - startMs;
      const ratio = span > 0 ? Math.max(0, Math.min(1, (Date.now() - startMs) / span)) : 0;
      const next = `${(ratio * 100).toFixed(2)}%`;
      if (el.style.width !== next) el.style.width = next;
    };
    apply();
    return subscribeBpTick(apply);
  }, [startMs, endMs]);

  return (
    <span
      aria-hidden
      className="mt-[2px] block h-[3px] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]"
    >
      <span ref={ref} className="block h-full rounded-full bg-[var(--bp-live)]" />
    </span>
  );
}

export function BpGuideBlock({
  cell,
  row,
  windowStart,
  metrics,
  nowMs,
  focused,
  title,
  channelName,
  onPlay,
}: {
  cell: BpGuideCell;
  row: number;
  windowStart: number;
  metrics: GuideMetrics;
  nowMs: number;
  focused: boolean;
  title: string;
  channelName: string;
  onPlay: () => void;
}) {
  const program = cell.program;
  const raw = (cell.endMs - cell.startMs) * metrics.pxPerMs;
  const left = (cell.startMs - windowStart) * metrics.pxPerMs;
  const width = program
    ? Math.max(MIN_BLOCK_PX, raw - BLOCK_GUTTER_PX)
    : Math.max(MIN_CELL_PX, raw);
  const tier = width < NARROW_PX ? "narrow" : width < FULL_PX ? "title" : "full";
  const narrow = tier === "narrow";
  const airing = program != null && program.startMs <= nowMs && nowMs < program.endMs;
  const past = program != null && cell.endMs <= nowMs;
  const range = program
    ? `${formatTimeLabel(program.startMs)} – ${formatTimeLabel(program.endMs)}`
    : null;
  const leadsIn = program != null && program.startMs < cell.startMs;
  const runsOut = program != null && program.endMs > cell.endMs;
  const timeLine = tier === "full" ? range : null;
  // An EPG title that merely echoes the channel name is junk and is suppressed:
  // the column already says the name. The rectangle stays either way, so the
  // lane never loses a cell and cellIndexAt can never return -1.
  const titled = title !== "" && !bpSameText(title, channelName);
  const paint = program == null ? "" : airing ? AIRING : past ? PAST : FUTURE;
  const ariaLabel = program
    ? range
      ? `${title}, ${range}`
      : title
    : `${channelName}, ${formatTimeLabel(cell.startMs)} – ${formatTimeLabel(cell.endMs)}`;

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-guide-row={row}
      data-bp-guide-cell="program"
      data-bp-cell-start={cell.startMs}
      data-bp-cell-end={cell.endMs}
      data-bp-autofocus={focused ? "true" : undefined}
      onClick={onPlay}
      aria-label={ariaLabel}
      style={{ left, width, top: BLOCK_INSET_Y_PX, bottom: BLOCK_INSET_Y_PX }}
      className={`${SHELL} ${RING} ${paint} ${narrow ? "px-[5px]" : "px-[clamp(6px,0.55vw,13px)]"}`}
    >
      {program == null ? null : (
        <>
          <span className="flex items-center gap-[4px]">
            {leadsIn && (
              <ChevronLeft
                size={narrow ? 12 : 16}
                strokeWidth={2.4}
                className="shrink-0 text-ink-subtle"
              />
            )}
            {titled && (
              <span
                dir="auto"
                className={`line-clamp-1 min-w-0 flex-1 font-semibold leading-[1.2] text-ink ${
                  narrow ? "text-[clamp(12px,1.3vh,15px)]" : "text-[clamp(16px,1.85vh,23px)]"
                }`}
              >
                {title}
              </span>
            )}
            {runsOut && (
              <ChevronRight
                size={narrow ? 12 : 16}
                strokeWidth={2.4}
                className="shrink-0 text-ink-subtle"
              />
            )}
          </span>

          {timeLine && (
            <span
              dir="auto"
              className="line-clamp-1 text-[clamp(13px,1.45vh,17px)] font-medium tabular-nums"
            >
              {timeLine}
            </span>
          )}

          {tier === "full" && airing && (
            <BlockProgress startMs={program.startMs} endMs={program.endMs} />
          )}
        </>
      )}
    </button>
  );
}
