const DAY_MS = 86_400_000;

/** Only dated releases from the last 30 calendar days belong in “Just released”. */
export function isRecentRelease(value: unknown, now = Date.now()): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== value) return false;
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  return date <= today && date >= today - 29 * DAY_MS;
}
