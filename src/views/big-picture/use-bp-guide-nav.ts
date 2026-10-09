import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { IptvChannel } from "@/lib/iptv/types";
import {
  bpOverlayOpen,
  markBpInteracted,
  recoverBpFocus,
  setBpFocus,
  type BpDir,
} from "./bp-focus-core";
import { SLOT_MS } from "./bp-guide-geometry";
import { setBpGuideKeyHandler } from "./bp-guide-key";
import { cellIndexAt, type BpGuideCell } from "./bp-guide-lane";
import type { BpGuideRow } from "./use-bp-guide-data";
import type { BpGuideCursor } from "./use-bp-guide-layout";

type LaneFor = (channel: IptvChannel, windowStart: number, windowEnd: number) => BpGuideCell[];
type GuideWindow = { start: number; end: number };
type CellKind = "channel" | "program";
type Target = { row: number; kind: CellKind; ms: number };
type Pending = Target & { dir: BpDir };
type Run = { dir: BpDir | null; at: number; run: number };

export type BpGuideNavParams = {
  guideRef: React.RefObject<HTMLElement | null>;
  rows: BpGuideRow[];
  laneFor: LaneFor;
  windowRef: React.RefObject<GuideWindow>;
  extendWindow: () => number | null;
  extendWindowBack: () => number | null;
  setCursor: (cursor: BpGuideCursor) => void;
  panView: (deltaPx: number) => void;
};

const WHEEL_STEP_PX = 100;
const RUN_GAP_MS = 260;
const RUN_SLOT_AT = 4;
const RUN_BIG_AT = 10;
const BIG_JUMP_MS = 2 * 60 * 60_000;
const IDLE_RUN: Run = { dir: null, at: 0, run: 0 };

type VisibilityProbe = { checkVisibility?: (opts: Record<string, boolean>) => boolean };

function rootHidden(root: HTMLElement): boolean {
  const probe = root as unknown as VisibilityProbe;
  if (typeof probe.checkVisibility !== "function") return false;
  return !probe.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
}

function laneOf(p: BpGuideNavParams, row: number): BpGuideCell[] {
  const channel = p.rows[row]?.channel;
  if (!channel) return [];
  const w = p.windowRef.current;
  return p.laneFor(channel, w.start, w.end);
}

function cellStartAt(p: BpGuideNavParams, row: number, ms: number): number {
  const lane = laneOf(p, row);
  if (lane.length === 0) return p.windowRef.current.start;
  return lane[cellIndexAt(lane, ms)].startMs;
}

function queryCell(
  root: HTMLElement | null,
  row: number,
  kind: CellKind,
  cellStart: number,
): HTMLElement | null {
  if (!root) return null;
  const sel =
    kind === "channel"
      ? `[data-bp-guide-row="${row}"][data-bp-guide-cell="channel"]`
      : `[data-bp-guide-row="${row}"][data-bp-cell-start="${cellStart}"]`;
  return root.querySelector<HTMLElement>(sel);
}

// A held arrow accelerates so eight hours of listings is reachable without
// eight hundred presses. Never in the channel column: a held Left there would
// blow straight past the star.
function accelStep(runRef: React.RefObject<Run>, dir: BpDir): number {
  const at = Date.now();
  const prev = runRef.current;
  const run = prev.dir === dir && at - prev.at < RUN_GAP_MS ? prev.run + 1 : 0;
  runRef.current = { dir, at, run };
  if (run >= RUN_BIG_AT) return BIG_JUMP_MS;
  if (run >= RUN_SLOT_AT) return SLOT_MS;
  return 0;
}

// The anchor keeps the jumped-to instant rather than snapping to the cell it
// landed in. Snapping stalls a held arrow forever inside any programme longer
// than the jump, because the next press adds the same delta to the same start.
function landOn(
  row: number,
  lane: BpGuideCell[],
  ms: number,
  anchorRef: React.RefObject<number>,
): Target {
  const lo = lane[0].startMs;
  const hi = lane[lane.length - 1].endMs - 1;
  anchorRef.current = Math.max(lo, Math.min(hi, ms));
  return { row, kind: "program", ms: anchorRef.current };
}

// The window ref is mutated synchronously by both extenders, so re-reading the
// lane after a successful grow returns the enlarged one in the same press.
function jumpTo(
  p: BpGuideNavParams,
  row: number,
  dir: BpDir,
  step: number,
  anchorRef: React.RefObject<number>,
): Target | null {
  let lane = laneOf(p, row);
  if (lane.length === 0) return null;
  const want = dir === "left" ? anchorRef.current - step : anchorRef.current + step;
  const past = dir === "left" ? want < lane[0].startMs : want >= lane[lane.length - 1].endMs;
  if (past) {
    const grown = dir === "left" ? p.extendWindowBack() : p.extendWindow();
    if (grown != null) {
      const next = laneOf(p, row);
      if (next.length > 0) lane = next;
    }
  }
  return landOn(row, lane, want, anchorRef);
}

function resolveTarget(
  p: BpGuideNavParams,
  dir: BpDir,
  row: number,
  kind: CellKind,
  anchorRef: React.RefObject<number>,
  runRef: React.RefObject<Run>,
): Target | null {
  if (dir === "up" || dir === "down") {
    runRef.current = IDLE_RUN;
    const next = row + (dir === "down" ? 1 : -1);
    if (next < 0 || next >= p.rows.length) return null;
    return { row: next, kind, ms: anchorRef.current };
  }
  if (kind === "channel") {
    runRef.current = IDLE_RUN;
    if (dir === "left") {
      const old = p.extendWindowBack();
      if (old == null) return null;
      anchorRef.current = old - 1;
      return { row, kind: "program", ms: anchorRef.current };
    }
    const w = p.windowRef.current;
    anchorRef.current = Math.max(w.start, Math.min(w.end - 1, Date.now()));
    return { row, kind: "program", ms: anchorRef.current };
  }
  const step = accelStep(runRef, dir);
  if (step > 0) return jumpTo(p, row, dir, step, anchorRef);
  const lane = laneOf(p, row);
  if (lane.length === 0) return null;
  const at = cellIndexAt(lane, anchorRef.current);
  if (dir === "left") {
    if (at <= 0) return { row, kind: "channel", ms: anchorRef.current };
    anchorRef.current = lane[at - 1].startMs;
    return { row, kind: "program", ms: anchorRef.current };
  }
  if (at < lane.length - 1) {
    anchorRef.current = lane[at + 1].startMs;
    return { row, kind: "program", ms: anchorRef.current };
  }
  const grown = p.extendWindow();
  if (grown == null) return null;
  anchorRef.current = grown;
  return { row, kind: "program", ms: grown };
}

function applyTarget(
  p: BpGuideNavParams,
  target: Target,
  dir: BpDir,
  pendingRef: React.RefObject<Pending | null>,
): void {
  const cellStart = target.kind === "channel" ? 0 : cellStartAt(p, target.row, target.ms);
  p.setCursor({ row: target.row, kind: target.kind, cellStart });
  const el = queryCell(p.guideRef.current, target.row, target.kind, cellStart);
  if (el) {
    setBpFocus(el, { dir });
    return;
  }
  pendingRef.current = { ...target, dir };
}

function guideMove(
  p: BpGuideNavParams,
  anchorRef: React.RefObject<number>,
  pendingRef: React.RefObject<Pending | null>,
  runRef: React.RefObject<Run>,
  dir: BpDir,
): boolean {
  const root = p.guideRef.current;
  if (!root || rootHidden(root)) return false;
  if (bpOverlayOpen()) return false;
  if (document.querySelector("[data-bp-dialog]")) return false;

  const focused = document.querySelector<HTMLElement>("[data-bp-focus='true']");
  if (!focused || !root.contains(focused)) return false;

  const row = Number(focused.dataset.bpGuideRow);
  if (!Number.isInteger(row) || row < 0 || row >= p.rows.length) return false;
  const kind: CellKind = focused.dataset.bpGuideCell === "channel" ? "channel" : "program";

  if (kind === "program") {
    const start = Number(focused.dataset.bpCellStart);
    const end = Number(focused.dataset.bpCellEnd);
    const inside = anchorRef.current >= start && anchorRef.current < end;
    if (Number.isFinite(start) && Number.isFinite(end) && !inside) anchorRef.current = start;
  }

  const target = resolveTarget(p, dir, row, kind, anchorRef, runRef);
  if (!target) return false;
  markBpInteracted();
  applyTarget(p, target, dir, pendingRef);
  return true;
}

export function useBpGuideNav(params: BpGuideNavParams): {
  setAnchorMs: (ms: number) => void;
  onWheel: (e: React.WheelEvent) => void;
} {
  const ref = useRef(params);
  ref.current = params;
  const anchorRef = useRef(0);
  const pendingRef = useRef<Pending | null>(null);
  const runRef = useRef<Run>(IDLE_RUN);
  const wheelRef = useRef(0);

  useEffect(() => {
    setBpGuideKeyHandler((dir) => guideMove(ref.current, anchorRef, pendingRef, runRef, dir));
    return () => setBpGuideKeyHandler(null);
  }, []);

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const p = ref.current;
    const cellStart = pending.kind === "channel" ? 0 : cellStartAt(p, pending.row, pending.ms);
    const el = queryCell(p.guideRef.current, pending.row, pending.kind, cellStart);
    if (el) {
      setBpFocus(el, { dir: pending.dir });
      return;
    }
    recoverBpFocus(p.guideRef.current);
  });

  const setAnchorMs = useCallback((ms: number) => {
    anchorRef.current = ms;
    runRef.current = IDLE_RUN;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const p = ref.current;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      p.panView(e.deltaX);
      return;
    }
    wheelRef.current += e.deltaY;
    const steps = Math.trunc(wheelRef.current / WHEEL_STEP_PX);
    if (steps === 0) return;
    wheelRef.current -= steps * WHEEL_STEP_PX;
    guideMove(p, anchorRef, pendingRef, runRef, steps > 0 ? "down" : "up");
  }, []);

  return { setAnchorMs, onWheel };
}
