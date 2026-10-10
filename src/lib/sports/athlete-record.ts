/** ESPN keeps the career line on a separate records resource, keyed "overall" with type "total". */
export function parseAthleteRecord(raw: unknown): string {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return "";
  const rows = items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  const overall =
    rows.find((row) => row.type === "total" || row.name === "overall") ?? rows[0];
  if (!overall) return "";
  const value = overall.summary ?? overall.displayValue;
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{1,3}-\d{1,3}(-\d{1,3})?$/.test(trimmed) ? trimmed : "";
}

const cache = new Map<string, { at: number; record: string }>();
const TTL_MS = 6 * 60 * 60_000;

export function cachedAthleteRecord(athleteId: string): string | undefined {
  const held = cache.get(athleteId);
  if (!held) return undefined;
  if (Date.now() - held.at > TTL_MS) {
    cache.delete(athleteId);
    return undefined;
  }
  return held.record;
}

export function rememberAthleteRecord(athleteId: string, record: string): void {
  cache.set(athleteId, { at: Date.now(), record });
  while (cache.size > 300) cache.delete(cache.keys().next().value!);
}

export function athleteRecordUrl(athleteId: string): string {
  return `https://sports.core.api.espn.com/v2/sports/mma/athletes/${athleteId}/records`;
}

export function isEspnAthleteId(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{1,12}$/.test(value);
}
