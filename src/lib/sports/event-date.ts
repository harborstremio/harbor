/** A date-only calendar entry has no timezone or published start time. */
export function formatSportsEventDate(
  ms: number,
  locale: string,
  short = false,
  dateOnly?: string,
): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(short ? {} : { weekday: "short" }),
  };
  if (dateOnly !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "";
    const date = new Date(`${dateOnly}T12:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateOnly) return "";
    return date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
  }
  const date = new Date(ms);
  if (!ms || !Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(locale, {
    ...options,
    hour: "numeric",
    minute: "2-digit",
  });
}
