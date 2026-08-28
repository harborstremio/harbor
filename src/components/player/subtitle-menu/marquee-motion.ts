const MIN_DURATION_MS = 1_200;
const MAX_DURATION_MS = 6_000;
const PIXELS_PER_SECOND = 42;

export function marqueeDurationMs(distancePx: number): number {
  return Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, Math.round((distancePx / PIXELS_PER_SECOND) * 1_000)),
  );
}
