import { useLayoutEffect, useMemo, useState } from "react";
import { CELL_PAD_MS, ROW_OVERSCAN, guideMetrics, type GuideMetrics } from "./bp-guide-geometry";
import type { BpGuideCell } from "./bp-guide-lane";
import { bpSafeAreaPx } from "./bp-safe-area";

export type BpGuideCursor = { row: number; kind: "channel" | "program"; cellStart: number };

export type BpGuideMountRange = { viewTopRow: number; mountStart: number; mountEnd: number };

// The safe rectangle rides in the size state rather than being read at derive
// time, so a resize re-derives it and the identity guard still stops the
// ResizeObserver from looping on an unchanged box.
type Size = { w: number; h: number; sx: number; sy: number };

export function useBpGuideMetrics(ref: React.RefObject<HTMLElement | null>): GuideMetrics | null {
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 2 || h < 2) return;
      const safe = bpSafeAreaPx();
      setSize((prev) =>
        prev && prev.w === w && prev.h === h && prev.sx === safe.x && prev.sy === safe.y
          ? prev
          : { w, h, sx: safe.x, sy: safe.y },
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return useMemo(
    () => (size ? guideMetrics(size.w, size.h, { x: size.sx, y: size.sy }) : null),
    [size],
  );
}

export function bpMountRange(
  cursorRow: number,
  total: number,
  rowsVisible: number,
): BpGuideMountRange {
  if (total === 0) return { viewTopRow: 0, mountStart: 0, mountEnd: 0 };
  const row = Math.max(0, Math.min(total - 1, cursorRow));
  const maxTop = Math.max(0, total - rowsVisible);
  const viewTopRow = Math.max(0, Math.min(maxTop, row - Math.floor(rowsVisible / 2)));
  const mountStart = Math.max(0, Math.min(viewTopRow - ROW_OVERSCAN, row - 1));
  const mountEnd = Math.min(total, Math.max(viewTopRow + rowsVisible + ROW_OVERSCAN, row + 2));
  return { viewTopRow, mountStart, mountEnd };
}

export function bpVisibleCells(
  cells: BpGuideCell[],
  viewStartMs: number,
  visibleMs: number,
  keepStart: number | null,
): BpGuideCell[] {
  const from = viewStartMs - CELL_PAD_MS;
  const to = viewStartMs + visibleMs + CELL_PAD_MS;
  const out = cells.filter((c) => c.endMs > from && c.startMs < to);
  if (keepStart == null || out.some((c) => c.startMs === keepStart)) return out;
  const held = cells.find((c) => c.startMs === keepStart);
  return held ? [...out, held] : out;
}
