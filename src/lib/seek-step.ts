export const SEEK_STEP_OPTIONS = [1, 3, 5, 10, 15, 30, 60, 90] as const;

export type SeekStepSeconds = (typeof SEEK_STEP_OPTIONS)[number];

export function isSeekStepSeconds(value: unknown): value is SeekStepSeconds {
  return typeof value === "number" && SEEK_STEP_OPTIONS.includes(value as SeekStepSeconds);
}

export function sanitizeSeekStep(value: unknown, fallback: number): number {
  return isSeekStepSeconds(value) ? value : fallback;
}
