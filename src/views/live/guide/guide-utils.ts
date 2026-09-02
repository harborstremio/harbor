export const PX_PER_MIN = 5;
export const PX_PER_MS = PX_PER_MIN / 60_000;
export const CHANNEL_COL_PX = 200;
export const ROW_HEIGHT_PX = 76;
export const RULER_HEIGHT_PX = 52;
export const HISTORY_HOURS = 12;
export const WINDOW_HOURS = 48;
export const WINDOW_PX = WINDOW_HOURS * 60 * PX_PER_MIN;

export function startOfWindow(nowMs: number, paddingBeforeMinutes = HISTORY_HOURS * 60): number {
  const slotMs = 30 * 60_000;
  const aligned = Math.floor((nowMs - paddingBeforeMinutes * 60_000) / slotMs) * slotMs;
  return aligned;
}

export function formatTimeLabel(ms: number, locale?: string): string {
  const d = new Date(ms);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDayLabel(ms: number, todayMs: number): string {
  const d = new Date(ms);
  const today = new Date(todayMs);
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function clampDuration(startMs: number, endMs: number, windowStart: number, windowEnd: number): {
  visibleStart: number;
  visibleEnd: number;
} | null {
  const visibleStart = Math.max(startMs, windowStart);
  const visibleEnd = Math.min(endMs, windowEnd);
  if (visibleEnd <= visibleStart) return null;
  return { visibleStart, visibleEnd };
}
