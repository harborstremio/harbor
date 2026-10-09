export const SLOT_MS = 30 * 60_000;
// Matches the desktop guide's startOfWindow(nowMs, 60), so now seeds about a
// third of the way into the lane and there is real past to step back into
// before extendWindowBack has to grow the window.
export const PAST_PAD_MIN = 60;
export const INITIAL_WINDOW_MS = 6 * 60 * 60_000;
export const EXTEND_MS = 3 * 60 * 60_000;
export const MAX_WINDOW_MS = 26 * 60 * 60_000;
// A visual floor only, never applied to left, so consecutive blocks stay
// aligned and a two hour film stays exactly four times a half hour show.
export const MIN_CELL_PX = 8;
export const CELL_PAD_MS = SLOT_MS;
export const ROW_OVERSCAN = 2;

export type GuideMetrics = {
  pxPerMs: number;
  lanePx: number;
  colPx: number;
  visibleMs: number;
  rowPx: number;
  rowsVisible: number;
  rulerPx: number;
  slotPx: number;
};

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// The half hour slot is sized from the viewport, not the lane divided into a
// slot count, so time density stays proportional and a handheld shows roughly
// the same three hour span as a wall TV instead of stretching to fill.
//
// The guide is measured against the whole viewport now that it bleeds, so the
// safe rectangle has to come in here rather than being paid for with a gutter.
// Painting still uses the full lanePx, which is what lets a block bleed into
// the crop on purpose. visibleMs and rowsVisible use the inset instead, so
// viewStartFor and bpMountRange can never park a focused cell or a whole row
// inside the strip a TV cuts off. At overscan 0 all three collapse to the old
// arithmetic exactly.
export function guideMetrics(w: number, h: number, safe: { x: number; y: number }): GuideMetrics {
  const colPx = Math.round(clamp((w - safe.x) * 0.155, 220, 340)) + safe.x;
  const lanePx = Math.max(1, w - colPx);
  const rulerPx = Math.round(clamp(h * 0.075, 44, 64));
  const rowPx = Math.round(clamp(h * 0.155, 88, 128));
  const rowsVisible = Math.max(1, Math.floor((h - rulerPx - safe.y) / rowPx));
  const slotPx = clamp(w * 0.14, 150, 232);
  const pxPerMs = slotPx / SLOT_MS;
  return {
    pxPerMs,
    lanePx,
    colPx,
    visibleMs: Math.max(1, lanePx - safe.x) / pxPerMs,
    rowPx,
    rowsVisible,
    rulerPx,
    slotPx,
  };
}

export function slotTicks(windowStart: number, windowEnd: number): number[] {
  const out: number[] = [];
  for (let ms = windowStart; ms < windowEnd; ms += SLOT_MS) out.push(ms);
  return out;
}

// A cell wider than the viewport pins to its start, so a three hour movie shows
// its title instead of scrolling to an empty middle.
export function viewStartFor(
  cellStart: number,
  cellEnd: number,
  cur: number,
  metrics: GuideMetrics,
  windowStart: number,
  windowEnd: number,
): number {
  const last = Math.max(windowStart, windowEnd - metrics.visibleMs);
  let next = cur;
  if (cellStart < cur) next = cellStart;
  else if (cellEnd > cur + metrics.visibleMs) {
    next = Math.min(cellStart, cellEnd - metrics.visibleMs);
  }
  return clamp(next, windowStart, last);
}
