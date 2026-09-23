export const SUB_BORDER_SIZE_MIN = 1;
export const SUB_BORDER_SIZE_MAX = 6;
const STEP = 0.5;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Clamp the outline thickness to [1, 6] and snap to the 0.5 UI step so
 * floating point drift can never accumulate in the stored setting.
 */
export function normalizeSubBorderSize(value: number): number {
  if (!Number.isFinite(value)) return SUB_BORDER_SIZE_MIN;
  return clamp(Math.round(value / STEP) * STEP, SUB_BORDER_SIZE_MIN, SUB_BORDER_SIZE_MAX);
}

/** One +/- click on the player quick menu, snapped to the 0.5 step. */
export function stepSubBorderSize(value: number, direction: -1 | 1): number {
  const base = Number.isFinite(value) ? value : SUB_BORDER_SIZE_MIN;
  return normalizeSubBorderSize(base + direction * STEP);
}

/** Display form for the thickness value, trimming floating point noise. */
export function formatSubBorderSize(value: number): string {
  return `${Number(value.toFixed(2))}px`;
}
