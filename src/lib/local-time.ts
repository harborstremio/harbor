export type FullscreenClockFormat = "system" | "12h" | "24h";
export type FullscreenClockStyle = "glass" | "minimal" | "solid" | "accent";

export const FULLSCREEN_CLOCK_SIZE_MIN_PX = 11;
export const FULLSCREEN_CLOCK_SIZE_MAX_PX = 24;
export const DEFAULT_FULLSCREEN_CLOCK_SIZE_PX = 13;

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(format: FullscreenClockFormat, showSeconds: boolean): Intl.DateTimeFormat {
  const key = `${format}:${showSeconds}`;
  const cached = FORMATTERS.get(key);
  if (cached) return cached;

  const hourCycle = format === "12h" ? "h12" : format === "24h" ? "h23" : undefined;
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" as const } : {}),
    ...(hourCycle ? { hourCycle } : {}),
  });
  FORMATTERS.set(key, formatter);
  return formatter;
}

export function formatLocalTime(
  date: Date,
  format: FullscreenClockFormat = "system",
  showSeconds = false,
): string {
  return formatterFor(format, showSeconds).format(date);
}

export function msUntilNextClockTick(nowMs: number, showSeconds: boolean): number {
  const interval = showSeconds ? 1_000 : 60_000;
  const elapsed = ((nowMs % interval) + interval) % interval;
  return interval - elapsed;
}

export function estimatePlaybackEndTime(
  now: Date,
  durationSec: number,
  positionSec: number,
  playbackRate = 1,
): Date | null {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(durationSec) ||
    !Number.isFinite(positionSec) ||
    !Number.isFinite(playbackRate) ||
    durationSec <= 0 ||
    positionSec < 0 ||
    playbackRate <= 0
  ) {
    return null;
  }

  const remainingSec = (durationSec - positionSec) / playbackRate;
  return remainingSec > 0 ? new Date(now.getTime() + remainingSec * 1_000) : null;
}

export function sanitizeFullscreenClockFormat(value: unknown): FullscreenClockFormat {
  return value === "12h" || value === "24h" ? value : "system";
}

export function sanitizeFullscreenClockStyle(value: unknown): FullscreenClockStyle {
  return value === "minimal" || value === "solid" || value === "accent" ? value : "glass";
}

export function sanitizeFullscreenClockSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_FULLSCREEN_CLOCK_SIZE_PX;
  }

  return Math.min(
    FULLSCREEN_CLOCK_SIZE_MAX_PX,
    Math.max(FULLSCREEN_CLOCK_SIZE_MIN_PX, Math.round(value)),
  );
}
