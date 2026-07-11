import { useT } from "@/lib/i18n";
import type { EpgProgram } from "@/lib/iptv/types";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { formatTimeLabel, PX_PER_MS } from "./guide-utils";

const HIDE_DELAY_MS = 150;
const SHOW_DELAY_MS = 280;

export function GuideProgramBlock({
  program,
  windowStart,
  rowTop,
  rowHeight,
  nowMs,
  onClick,
  replayable = false,
}: {
  program: EpgProgram;
  windowStart: number;
  rowTop: number;
  rowHeight: number;
  nowMs: number;
  onClick: () => void;
  replayable?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current != null) clearTimeout(hideTimerRef.current);
      if (showTimerRef.current != null) clearTimeout(showTimerRef.current);
    },
    [],
  );

  const isPast = program.endMs <= nowMs;
  const isLive = !isPast && program.startMs <= nowMs && nowMs < program.endMs;

  const left = (program.startMs - windowStart) * PX_PER_MS;
  const width = (program.endMs - program.startMs) * PX_PER_MS;
  const compact = width < 70;
  const veryCompact = width < 40;

  const cancelHide = () => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setHovering(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  };

  const recomputePos = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const viewportW = window.innerWidth;
    const center = Math.max(170, Math.min(viewportW - 170, r.left + r.width / 2));
    const below = r.top < 180;
    setPos({
      left: center,
      top: below ? r.bottom + 8 : r.top - 8,
      below,
    });
  };

  const onEnter = () => {
    cancelHide();
    if (showTimerRef.current != null) return;
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      recomputePos();
      setHovering(true);
    }, SHOW_DELAY_MS);
  };

  const onLeave = () => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    scheduleHide();
  };

  const canReplay = isPast && !isLive && replayable;
  const stateClass = isLive
    ? "border-danger/45 bg-danger/15 hover:bg-danger/25"
    : canReplay
      ? "border-accent/35 bg-elevated/70 hover:border-accent hover:bg-raised"
      : isPast
        ? "border-edge-soft/30 bg-elevated/35 opacity-50 hover:opacity-70"
        : "border-edge-soft/55 bg-elevated/85 hover:border-edge hover:bg-raised";

  return (
    <>
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        className={`group absolute overflow-hidden rounded-lg border text-start transition-colors duration-150 ${stateClass}`}
        style={{
          top: rowTop + 4,
          height: rowHeight - 8,
          left: left + 3,
          width: Math.max(20, width - 6),
        }}
      >
        <div className="flex h-full flex-col justify-between gap-1 px-2.5 py-1.5">
          <div
            dir="auto"
            className={`truncate font-semibold leading-tight ${
              isPast ? "text-ink-muted" : "text-ink"
            } ${veryCompact ? "text-[11px]" : "text-[12.5px]"}`}
          >
            {program.title}
          </div>
          {!compact && (
            <div className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-ink-subtle">
              <span>{formatTimeLabel(program.startMs)}</span>
              <span>{formatTimeLabel(program.endMs)}</span>
              {isLive && (
                <span className="ms-auto rounded-full bg-danger/80 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.16em] text-canvas">
                  {t("Live")}
                </span>
              )}
              {canReplay ? (
                <span className="ms-auto flex items-center gap-1 rounded-full bg-accent/20 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                  <RotateCcw size={9} strokeWidth={2.6} />
                  {t("Replay")}
                </span>
              ) : (
                isPast &&
                !isLive && (
                  <span className="ms-auto rounded-full bg-canvas/55 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                    {t("Ended")}
                  </span>
                )
              )}
            </div>
          )}
        </div>
      </button>
      {hovering && pos && (
        <ProgramTooltip
          program={program}
          pos={pos}
          isPast={isPast}
          isLive={isLive}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </>
  );
}

function ProgramTooltip({
  program,
  pos,
  isPast,
  isLive,
  onMouseEnter,
  onMouseLeave,
}: {
  program: EpgProgram;
  pos: { left: number; top: number; below: boolean };
  isPast: boolean;
  isLive: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const t = useT();
  const startTime = formatTimeLabel(program.startMs);
  const endTime = formatTimeLabel(program.endMs);
  const durationMin = Math.round((program.endMs - program.startMs) / 60_000);
  return createPortal(
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="pointer-events-auto fixed z-[200] w-[320px] rounded-xl border border-edge-soft bg-elevated text-start text-ink shadow-[0_22px_60px_-12px_rgba(0,0,0,0.75)]"
      style={{
        left: pos.left,
        top: pos.top,
        transform: pos.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      <div className="flex flex-col gap-1.5 px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          {isLive && (
            <span className="flex h-4 items-center gap-1 rounded-full bg-danger px-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-canvas">
              <span className="h-1 w-1 rounded-full bg-canvas" />
              {t("Live")}
            </span>
          )}
          {isPast && !isLive && (
            <span className="flex h-4 items-center rounded-full bg-canvas/55 px-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Ended")}
            </span>
          )}
        </div>
        <h3 dir="auto" className="text-[14px] font-semibold leading-tight text-ink">
          {program.title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11.5px] tabular-nums text-ink-muted">
          <span>{startTime}</span>
          <span className="text-ink-subtle">→</span>
          <span>{endTime}</span>
          <span className="text-ink-subtle">·</span>
          <span>{durationMin}m</span>
        </div>
      </div>
      {program.description && (
        <div className="border-t border-edge-soft/40 px-3.5 py-2.5">
          <p
            dir="auto"
            className="text-[12.5px] leading-relaxed text-ink-muted [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical] overflow-hidden"
          >
            {program.description}
          </p>
        </div>
      )}
      {program.category && (
        <div className="border-t border-edge-soft/40 px-3.5 py-2">
          <span className="rounded-full bg-canvas/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {program.category}
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
