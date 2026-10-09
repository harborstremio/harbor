import { safeFetch } from "@/lib/safe-fetch";
import { normalizeSportsSearch } from "./search-text";

const DB = "https://www.thesportsdb.com/api/v1/json/123";
const TIMEOUT_MS = 9000;

export type SportsEventHit = {
  id: string;
  name: string;
  league: string;
  startMs: number;
  poster?: string;
  thumb?: string;
  badge?: string;
};

type DbRow = Record<string, string | null | undefined>;

async function rows(url: string, field: string, signal?: AbortSignal): Promise<DbRow[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, TIMEOUT_MS);
  try {
    const response = await safeFetch(url, { signal: controller.signal });
    if (!response.ok) return [];
    const body = (await response.json()) as Record<string, unknown>;
    const value = body[field];
    return Array.isArray(value) ? (value as DbRow[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function startOf(row: DbRow): number {
  const stamp = row.strTimestamp?.trim();
  if (stamp) {
    const parsed = Date.parse(stamp.endsWith("Z") ? stamp : `${stamp}Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const day = row.dateEvent?.trim();
  if (!day) return Number.NaN;
  const parsed = Date.parse(`${day}T${(row.strTime || "00:00:00").trim()}Z`);
  return Number.isFinite(parsed) ? parsed : Date.parse(`${day}T00:00:00Z`);
}

function toHit(row: DbRow, badge?: string): SportsEventHit | null {
  const id = row.idEvent?.trim();
  const name = row.strEvent?.trim();
  const startMs = startOf(row);
  if (!id || !name || !Number.isFinite(startMs)) return null;
  return {
    id,
    name,
    league: row.strLeague?.trim() || "",
    startMs,
    poster: row.strPoster || undefined,
    thumb: row.strThumb || undefined,
    badge,
  };
}

/**
 * searchevents.php matches the event name only, so a team query needs its own lane. The team
 * endpoint answers loosely, returning an unrelated club for a nickname, so its name is verified
 * against the query before its fixtures are trusted.
 */
export async function searchSportsEvents(
  query: string,
  signal?: AbortSignal,
): Promise<SportsEventHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const wanted = normalizeSportsSearch(trimmed);
  if (!wanted) return [];

  const byName = rows(`${DB}/searchevents.php?e=${encodeURIComponent(trimmed)}`, "event", signal);
  const byTeam = (async () => {
    const teams = await rows(`${DB}/searchteams.php?t=${encodeURIComponent(trimmed)}`, "teams", signal);
    const team = teams.find((entry) => {
      const name = normalizeSportsSearch(entry.strTeam ?? "");
      const alt = normalizeSportsSearch(entry.strTeamAlternate ?? "");
      return name.includes(wanted) || alt.includes(wanted);
    });
    const id = team?.idTeam?.trim();
    if (!id) return [] as SportsEventHit[];
    const badge = team?.strBadge || undefined;
    const next = await rows(`${DB}/eventsnext.php?id=${encodeURIComponent(id)}`, "events", signal);
    return next.flatMap((row) => toHit(row, badge) ?? []);
  })();

  const [named, teamed] = await Promise.all([
    byName.then((list) => list.flatMap((row) => toHit(row) ?? [])),
    byTeam,
  ]);

  const seen = new Set<string>();
  return [...named, ...teamed]
    .filter((hit) => !seen.has(hit.id) && seen.add(hit.id))
    .sort((left, right) => right.startMs - left.startMs)
    .slice(0, 8);
}
