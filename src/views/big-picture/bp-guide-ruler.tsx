import { useEffect, useRef } from "react";
import { formatTimeLabel } from "@/views/live/guide/guide-utils";
import { SLOT_MS, slotTicks, type GuideMetrics } from "./bp-guide-geometry";
import { useBpT } from "./bp-i18n";
import { subscribeBpTick } from "./bp-live-tick";

type T = (key: string, vars?: Record<string, string | number>) => string;

const HOUR_MS = 60 * 60_000;

function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayHint(ms: number, nowMs: number, t: T): string {
  const diff = Math.round((startOfDayMs(ms) - startOfDayMs(nowMs)) / 86_400_000);
  if (diff === 0) return t("Today");
  if (diff === 1) return t("Tomorrow");
  if (diff === -1) return t("Yesterday");
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

function BpGuideNowPill({
  viewStartMs,
  metrics,
  label,
}: {
  viewStartMs: number;
  metrics: GuideMetrics;
  label: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const measured = ref.current;
    if (!measured) return;
    // The pill used to be centred with a percentage translate, so at the lane
    // origin half of it was clipped away. Its own half width is folded into the
    // clamp instead, which keeps it whole at both ends of the lane.
    const half = measured.offsetWidth / 2;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const x = (Date.now() - viewStartMs) * metrics.pxPerMs;
      el.style.opacity = x >= 0 && x <= metrics.lanePx ? "1" : "0";
      const cx = Math.min(Math.max(x, half), Math.max(half, metrics.lanePx - half));
      el.style.transform = `translate3d(${(cx - half).toFixed(1)}px, 0, 0)`;
    };
    apply();
    return subscribeBpTick(apply);
  }, [viewStartMs, metrics, label]);

  return (
    <span
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute bottom-[5px] left-0 z-[2] flex h-[clamp(17px,2.1vh,24px)] items-center rounded-full px-[8px] text-[clamp(9px,1.2vh,13px)] font-bold uppercase tracking-[0.16em]"
      style={{ background: "var(--bp-live)", color: "var(--color-canvas)" }}
    >
      {label}
    </span>
  );
}

export function BpGuideRuler({
  windowStart,
  windowEnd,
  viewStartMs,
  metrics,
  nowMs,
  cursorTitle,
  cursorRange,
}: {
  windowStart: number;
  windowEnd: number;
  viewStartMs: number;
  metrics: GuideMetrics;
  nowMs: number;
  cursorTitle: string;
  cursorRange: string;
}) {
  const t = useBpT();
  const ticks = slotTicks(windowStart, windowEnd);
  const offsetPx = (viewStartMs - windowStart) * metrics.pxPerMs;
  const firstVisible = Math.max(0, Math.floor((viewStartMs - windowStart) / SLOT_MS));

  return (
    <div
      className="relative flex shrink-0"
      style={{
        height: metrics.rulerPx,
        background: "var(--bp-panel)",
        borderBottom: "1px solid var(--bp-edge-2)",
      }}
    >
      <div
        style={{
          width: metrics.colPx,
          flex: `0 0 ${metrics.colPx}px`,
          background: "var(--bp-panel)",
          borderInlineEnd: "1px solid var(--bp-edge)",
        }}
        className="flex flex-col justify-center gap-[1px] overflow-hidden ps-[calc(var(--bp-safe-x,0px)_+_clamp(9px,0.8vw,17px))] pe-[clamp(9px,0.8vw,17px)]"
      >
        <span dir="auto" className="truncate text-[clamp(15px,1.8vh,22px)] font-semibold text-ink">
          {cursorTitle}
        </span>
        <span className="truncate text-[clamp(12.5px,1.4vh,16px)] font-medium tabular-nums text-ink-subtle">
          {cursorRange}
        </span>
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
          style={{ transform: `translate3d(${-offsetPx}px, 0, 0)` }}
        >
          {ticks.map((ms, i) => {
            const major = new Date(ms).getMinutes() === 0;
            // Desktop prints the day under every hour, which at ten feet is
            // eight repetitions of the word Today. Printing it only at midnight
            // loses the boundary when the window opens mid evening. Both: the
            // day it changes, plus whatever tick the lane currently starts on.
            const hint =
              i === firstVisible || (major && startOfDayMs(ms) !== startOfDayMs(ms - HOUR_MS));
            return (
              <span
                key={ms}
                className="absolute inset-y-0 flex flex-col justify-center gap-[1px] ps-[clamp(6px,0.5vw,11px)]"
                style={{ left: (ms - windowStart) * metrics.pxPerMs, width: metrics.slotPx }}
              >
                <span
                  className={
                    major
                      ? "text-[clamp(15px,1.75vh,21px)] font-bold tabular-nums text-ink"
                      : "text-[clamp(14px,1.6vh,19px)] font-semibold tabular-nums text-ink-muted"
                  }
                >
                  {formatTimeLabel(ms)}
                </span>
                {hint && (
                  <span className="truncate text-[clamp(11px,1.2vh,14px)] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    {dayHint(ms, nowMs, t)}
                  </span>
                )}
                {/* The only tick in the entire guide. A hint of a gridline that
                    drops toward the body without ever crossing it: nothing
                    below the ruler is drawn vertically. */}
                {major && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 start-0 h-[10px] w-[2px] bg-[var(--bp-edge-2)]"
                  />
                )}
              </span>
            );
          })}
        </div>
        <BpGuideNowPill viewStartMs={viewStartMs} metrics={metrics} label={t("Now")} />
      </div>
    </div>
  );
}
