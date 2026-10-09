import { Star } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { CARD_GAP_X, CARD_GAP_Y, formatTimeLabel, PX_PER_MS } from "./guide-utils";
import { useProgramMeta } from "./use-program-meta";
import { ProgramCastRow } from "./program-cast-row";
import type { EpgProgram } from "@/lib/iptv/types";

const HIDE_DELAY_MS = 150;
const SHOW_DELAY_MS = 280;

export function GuideProgramBlock({
  program,
  windowStart,
  rowTop,
  rowHeight,
  nowMs,
  onClick,
  onHover,
  replayable = false,
}: {
  program: EpgProgram;
  windowStart: number;
  rowTop: number;
  rowHeight: number;
  nowMs: number;
  onClick: () => void;
  onHover?: (on: boolean) => void;
  replayable?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    above: number;
    below: number;
  } | null>(null);
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
  const progress =
    isLive && program.endMs > program.startMs
      ? Math.max(
          0,
          Math.min(
            1,
            (nowMs - program.startMs) / (program.endMs - program.startMs),
          ),
        )
      : null;
  const remainingMin = isLive
    ? Math.max(0, Math.round((program.endMs - nowMs) / 60_000))
    : null;

  const left = (program.startMs - windowStart) * PX_PER_MS;
  const width = (program.endMs - program.startMs) * PX_PER_MS;
  const compact = width < 70;
  const veryCompact = width < 40;
  const showEndTime = width >= 190;
  const showRemaining = width >= 250;

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
    const center = Math.max(
      170,
      Math.min(viewportW - 170, r.left + r.width / 2),
    );
    setPos({ left: center, above: r.top - 8, below: r.bottom + 8 });
  };

  const onEnter = () => {
    onHover?.(true);
    cancelHide();
    if (showTimerRef.current != null) return;
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null;
      recomputePos();
      setHovering(true);
    }, SHOW_DELAY_MS);
  };

  const onLeave = () => {
    onHover?.(false);
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    scheduleHide();
  };

  const canReplay = isPast && !isLive && replayable;
  const stateClass = isLive
    ? "bg-raised hover:bg-raised"
    : canReplay
      ? "bg-elevated hover:bg-raised"
      : isPast
        ? "bg-canvas/55 opacity-60 hover:opacity-85"
        : "bg-elevated hover:bg-raised";

  return (
    <>
      <button
        ref={ref}
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onFocus={onEnter}
        onBlur={onLeave}
        className={`group absolute overflow-hidden text-start transition-colors duration-150 ${stateClass}`}
        style={{
          top: rowTop,
          height: rowHeight - CARD_GAP_Y,
          left: left + CARD_GAP_X,
          width: Math.max(20, width - CARD_GAP_X),
        }}
      >
        <div className={`flex h-full flex-col ${veryCompact ? "px-2" : "px-5"} pb-2 pt-3`}>
          <div
            dir="auto"
            className={`truncate font-extrabold ${
              isPast ? "text-ink-muted" : "text-ink"
            } ${veryCompact ? "text-[12px] leading-[16px]" : "text-[15px] leading-[19px]"}`}
          >
            {program.title}
          </div>
          {!compact && program.description && (
            <p
              dir="auto"
              className="mt-2 line-clamp-2 min-h-0 flex-1 text-[12px] font-normal leading-[14px] text-ink-muted"
            >
              {program.description}
            </p>
          )}
          {!compact && (
            <div className="mt-auto flex flex-col gap-1 pt-1">
              <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden text-[10.5px] tabular-nums text-ink-subtle">
                <span className="shrink-0">{formatTimeLabel(program.startMs)}</span>
                {showEndTime && (
                  <span className="shrink-0">{formatTimeLabel(program.endMs)}</span>
                )}
                {remainingMin != null && showRemaining && (
                  <span className="shrink-0 text-ink-muted">
                    {t("{n}m left", { n: remainingMin })}
                  </span>
                )}
                {isLive && (
                  <span className="ms-auto shrink-0 rounded-full bg-danger/80 px-1.5 py-px text-[8.5px] font-semibold uppercase tracking-[0.16em] text-canvas">
                    {t("Live")}
                  </span>
                )}
                {canReplay ? (
                  <span className="ms-auto shrink-0 text-[8.5px] font-bold uppercase tracking-[0.16em] text-accent">
                    {t("Replay")}
                  </span>
                ) : (
                  isPast &&
                  !isLive && (
                    <span className="ms-auto shrink-0 text-[8.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                      {t("Ended")}
                    </span>
                  )
                )}
              </div>
              {progress != null && (
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-ink/20">
                  <div
                    className="h-full rounded-full bg-danger transition-[width] duration-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {compact && progress != null && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-canvas/55">
            <div
              className="h-full bg-danger transition-[width] duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
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
  pos: { left: number; above: number; below: number };
  isPast: boolean;
  isLive: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const place = () => {
      const h = el.offsetHeight;
      const wantsBelow = pos.above - h < 8;
      const raw = wantsBelow ? pos.below : pos.above - h;
      const max = Math.max(8, window.innerHeight - h - 8);
      setTop(Math.max(8, Math.min(raw, max)));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [pos.above, pos.below]);
  const startTime = formatTimeLabel(program.startMs);
  const endTime = formatTimeLabel(program.endMs);
  const durationMin = Math.round((program.endMs - program.startMs) / 60_000);
  const { settings } = useSettings();
  const { data: enriched } = useProgramMeta(program.title, settings.tmdbKey, true);
  const meta = enriched?.meta;
  const score = meta?.tmdbScore ?? (meta?.imdbRating ? Number(meta.imdbRating) : null);
  const year = meta?.releaseInfo?.slice(0, 4) ?? null;
  const overview = program.description ?? meta?.description ?? null;
  return createPortal(
    <div
      role="tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      ref={boxRef}
      className="pointer-events-auto fixed z-[200] w-[320px] rounded-md bg-elevated text-start text-ink ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      style={{
        left: pos.left,
        top: top ?? pos.below,
        transform: "translate(-50%, 0)",
        visibility: top == null ? "hidden" : undefined,
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
        <div className="flex items-start gap-3">
          {meta?.poster && (
            <img
              src={meta.poster}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-[81px] w-[54px] shrink-0 rounded-[5px] object-cover ring-1 ring-edge-soft"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 dir="auto" className="text-[14px] font-semibold leading-tight text-ink">
              {program.title}
            </h3>
            {(year || score || meta?.runtime) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-ink-subtle">
                {year && <span>{year}</span>}
                {score != null && Number.isFinite(score) && score > 0 && (
                  <span className="flex items-center gap-1 text-ink-muted">
                    <Star size={10} strokeWidth={2.4} className="fill-current" />
                    {score.toFixed(1)}
                  </span>
                )}
                {meta?.runtime && <span>{meta.runtime}</span>}
              </div>
            )}
            {!!meta?.genres?.length && (
              <span dir="auto" className="truncate text-[11px] text-ink-subtle">
                {meta.genres.slice(0, 3).join(" · ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] tabular-nums text-ink-muted">
          <span>{startTime}</span>
          <span className="text-ink-subtle">→</span>
          <span>{endTime}</span>
          <span className="text-ink-subtle">·</span>
          <span>{durationMin}m</span>
        </div>
      </div>
      {overview && (
        <div className="border-t border-edge-soft/40 px-3.5 py-2.5">
          <p
            dir="auto"
            className="text-[12.5px] leading-relaxed text-ink-muted [display:-webkit-box] [-webkit-line-clamp:5] [-webkit-box-orient:vertical] overflow-hidden"
          >
            {overview}
          </p>
        </div>
      )}
      {!!enriched?.cast.length && (
        <div className="border-t border-edge-soft/40 px-3.5 py-2.5">
          <ProgramCastRow cast={enriched.cast} />
          {!!enriched.directors.length && (
            <p className="mt-2 truncate text-[11px] text-ink-subtle">
              {t("Directed by {names}", { names: enriched.directors.join(", ") })}
            </p>
          )}
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
