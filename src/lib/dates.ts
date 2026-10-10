export function formatAirDate(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.length === 10 ? `${value}T00:00:00Z` : value;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatAirDateShort(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.length === 10 ? `${value}T00:00:00Z` : value;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return "";
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(day / 365)}y ago`;
}

const DAY_MS = 86400000;

export function daysFromTodayLocal(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const air = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  if (Number.isNaN(air.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((air.getTime() - today.getTime()) / DAY_MS);
}

export function isUpcomingDate(date: string | null | undefined): boolean {
  const d = daysFromTodayLocal(date);
  return d != null && d > 0;
}
