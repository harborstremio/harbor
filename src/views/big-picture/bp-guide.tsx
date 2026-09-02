import { useCallback, useEffect, useRef, useState } from "react";
import type { EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { formatTimeLabel, startOfWindow } from "@/views/live/guide/guide-utils";
import {
  EXTEND_MS,
  INITIAL_WINDOW_MS,
  MAX_WINDOW_MS,
  PAST_PAD_MIN,
  viewStartFor,
  type GuideMetrics,
} from "./bp-guide-geometry";
import { cellIndexAt, type BpGuideCell } from "./bp-guide-lane";
import { BpGuidePortal } from "./bp-guide-portal";
import { BpGuideRow } from "./bp-guide-row";
import { BpGuideRuler } from "./bp-guide-ruler";
import { useBpT } from "./bp-i18n";
import { subscribeBpTick } from "./bp-live-tick";
import type { BpGuideRow as BpGuideRowData } from "./use-bp-guide-data";
import { bpMountRange, useBpGuideMetrics, type BpGuideCursor } from "./use-bp-guide-layout";
import { useBpGuideNav } from "./use-bp-guide-nav";

type LaneFor = (channel: IptvChannel, windowStart: number, windowEnd: number) => BpGuideCell[];

function BpGuideNowLine({
  viewStartMs,
  metrics,
}: {
  viewStartMs: number;
  metrics: GuideMetrics;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const x = (Date.now() - viewStartMs) * metrics.pxPerMs;
      const clamped = Math.max(0, Math.min(metrics.lanePx, x));
      el.style.opacity = x >= 0 && x <= metrics.lanePx ? "1" : "0";
      el.style.transform = `translate3d(${(metrics.colPx + clamped).toFixed(1)}px, 0, 0)`;
    };
    apply();
    return subscribeBpTick(apply);
  }, [viewStartMs, metrics]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-[2px]"
      style={{ background: "var(--bp-live)" }}
    />
  );
}

export function BpGuide({
  rows,
  laneFor,
  nowMs,
  sourceId,
  resetKey,
  onPlay,
  onNowBoundary,
}: {
  rows: BpGuideRowData[];
  laneFor: LaneFor;
  nowMs: number;
  sourceId: string;
  resetKey: string;
  onPlay: (channel: IptvChannel, program: EpgProgram | null) => void;
  onNowBoundary?: (ms: number) => void;
}) {
  const t = useBpT();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const metrics = useBpGuideMetrics(rootRef);

  const [win, setWin] = useState(() => {
    const start = startOfWindow(Date.now(), PAST_PAD_MIN);
    return { start, end: start + INITIAL_WINDOW_MS };
  });
  const [viewStartMs, setViewStartMs] = useState(win.start);
  const [cursor, setCursor] = useState<BpGuideCursor>({
    row: 0,
    kind: "program",
    cellStart: win.start,
  });

  const winRef = useRef(win);
  winRef.current = win;
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const laneRef = useRef(laneFor);
  laneRef.current = laneFor;

  const extendWindow = useCallback(() => {
    const w = winRef.current;
    if (w.end - w.start >= MAX_WINDOW_MS) return null;
    const next = { start: w.start, end: Math.min(w.start + MAX_WINDOW_MS, w.end + EXTEND_MS) };
    winRef.current = next;
    setWin(next);
    return w.end;
  }, []);

  // Growing the start invalidates every cached lane, so every block in the
  // guide remounts in one commit. Focus survives that only through nav's
  // pendingRef path, which re-queries the cell in the same layout pass.
  const extendWindowBack = useCallback(() => {
    const w = winRef.current;
    const next = { start: Math.max(w.end - MAX_WINDOW_MS, w.start - EXTEND_MS), end: w.end };
    if (next.start === w.start) return null;
    winRef.current = next;
    setWin(next);
    return w.start;
  }, []);

  const panView = useCallback((deltaPx: number) => {
    const m = metricsRef.current;
    if (!m) return;
    const w = winRef.current;
    const last = Math.max(w.start, w.end - m.visibleMs);
    setViewStartMs((cur) => Math.max(w.start, Math.min(last, cur + deltaPx / m.pxPerMs)));
  }, []);

  const applyCursor = useCallback((next: BpGuideCursor) => {
    setCursor(next);
    const m = metricsRef.current;
    const channel = rowsRef.current[next.row]?.channel;
    if (!m || !channel || next.kind === "channel") return;
    const w = winRef.current;
    const lane = laneRef.current(channel, w.start, w.end);
    if (lane.length === 0) return;
    const cell = lane[cellIndexAt(lane, next.cellStart)];
    setViewStartMs((cur) => viewStartFor(cell.startMs, cell.endMs, cur, m, w.start, w.end));
  }, []);

  const { setAnchorMs, onWheel } = useBpGuideNav({
    guideRef: rootRef,
    rows,
    laneFor,
    windowRef: winRef,
    extendWindow,
    extendWindowBack,
    setCursor: applyCursor,
    panView,
  });

  const seededRef = useRef(false);

  useEffect(() => {
    seededRef.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (rows.length === 0 || seededRef.current) return;
    seededRef.current = true;
    const now = Date.now();
    const start = startOfWindow(now, PAST_PAD_MIN);
    const next = { start, end: start + INITIAL_WINDOW_MS };
    winRef.current = next;
    setWin(next);
    setViewStartMs(start);
    setAnchorMs(now);
    const lane = laneRef.current(rows[0].channel, start, next.end);
    setCursor({
      row: 0,
      kind: "program",
      cellStart: lane.length > 0 ? lane[cellIndexAt(lane, now)].startMs : start,
    });
  }, [rows, resetKey, setAnchorMs]);

  useEffect(() => {
    if (rows.length === 0) return;
    setCursor((cur) =>
      cur.row < rows.length ? cur : { row: rows.length - 1, kind: "channel", cellStart: 0 },
    );
  }, [rows.length]);

  const range = bpMountRange(cursor.row, rows.length, metrics?.rowsVisible ?? 1);
  const lanes: BpGuideCell[][] = [];
  if (metrics) {
    for (let i = range.mountStart; i < range.mountEnd; i += 1) {
      lanes.push(laneFor(rows[i].channel, win.start, win.end));
    }
  }

  let boundary = Number.POSITIVE_INFINITY;
  for (const lane of lanes) {
    for (const cell of lane) {
      const p = cell.program;
      if (!p || p.startMs > nowMs || p.endMs <= nowMs) continue;
      if (p.endMs < boundary) boundary = p.endMs;
    }
  }

  useEffect(() => {
    onNowBoundary?.(boundary);
  }, [boundary, onNowBoundary]);

  const active = rows[cursor.row] ?? null;
  const activeLane = metrics && active ? laneFor(active.channel, win.start, win.end) : null;
  const activeCell =
    activeLane && activeLane.length > 0
      ? activeLane[cellIndexAt(activeLane, cursor.cellStart)]
      : null;
  const activeProgram = activeCell?.program ?? null;
  // The channel name is already printed in the column of the row the cursor is
  // on. Falling back to it here made one row say the same words three times, so
  // the corner answers with the programme or with nothing.
  const cursorTitle = activeProgram?.title ?? t("No program info");
  const clock = activeProgram ?? activeCell;
  // Standing in for the desktop guide's hover tooltip, which carried the
  // category as well as the clock.
  const cursorRange = clock
    ? `${formatTimeLabel(clock.startMs)} – ${formatTimeLabel(clock.endMs)}${
        activeProgram?.category ? ` · ${activeProgram.category}` : ""
      }`
    : t("Live");

  return (
    <div
      ref={rootRef}
      dir="ltr"
      onWheel={onWheel}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Full bleed removed the panel fill, which left the grid reading directly
          on the ambient photograph and washed every cell out. This darkens the
          band without giving it an edge, so it still runs to the screen. It used
          to be two layers, the second a 90deg ramp faking a channel column; the
          column paints its own surface now, so one wash is the whole floor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in oklab, var(--bp-void) 88%, transparent) 0%, color-mix(in oklab, var(--bp-void) 95%, transparent) 10%, color-mix(in oklab, var(--bp-void) 96%, transparent) 100%)",
        }}
      />

      {metrics && rows.length > 0 && (
        <>
          <BpGuideRuler
            windowStart={win.start}
            windowEnd={win.end}
            viewStartMs={viewStartMs}
            metrics={metrics}
            nowMs={nowMs}
            cursorTitle={cursorTitle}
            cursorRange={cursorRange}
          />
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              className="relative z-[1] transition-transform duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)]"
              style={{ transform: `translate3d(0, ${-range.viewTopRow * metrics.rowPx}px, 0)` }}
            >
              <div style={{ height: range.mountStart * metrics.rowPx }} />
              {lanes.map((cells, i) => {
                const at = range.mountStart + i;
                return (
                  <BpGuideRow
                    key={`${at}-${rows[at].channel.id}`}
                    row={rows[at]}
                    index={at}
                    cells={cells}
                    windowStart={win.start}
                    viewStartMs={viewStartMs}
                    metrics={metrics}
                    nowMs={nowMs}
                    cursor={cursor}
                    sourceId={sourceId}
                    onPlay={onPlay}
                  />
                );
              })}
              <div style={{ height: (rows.length - range.mountEnd) * metrics.rowPx }} />
            </div>
            <BpGuideNowLine viewStartMs={viewStartMs} metrics={metrics} />
          </div>
          <BpGuidePortal
            channel={active?.channel ?? null}
            program={activeProgram}
            title={cursorTitle}
            meta={cursorRange}
            nowMs={nowMs}
            // Two rows is the portal's height at both target viewports. Any
            // taller and it covers the row bpMountRange parks the cursor on,
            // which is most of the time.
            dimmed={cursor.row >= range.viewTopRow + metrics.rowsVisible - 2}
          />
        </>
      )}
    </div>
  );
}
