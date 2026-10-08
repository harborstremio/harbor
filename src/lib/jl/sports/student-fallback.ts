import type { SchoolEvent } from "./sidearm.ts";

/**
 * When a school's athletics site doesn't answer, a student-athlete's season can come from
 * AllSports instead (only with the viewer's own AllSports key): the school's team found by name,
 * its recent and upcoming games as SchoolEvents (no stream links). Pure mapping, no I/O.
 */

/** AllSports' path prefix per sport. */
const SPORT_BASE: Record<string, string> = {
  football: "/api",
  "american-football": "/api/american-football",
  basketball: "/api/basketball",
  "ice-hockey": "/api/ice-hockey",
  baseball: "/api/baseball",
  volleyball: "/api/volleyball",
};

/** SIDEARM sport slug → AllSports sport path, and the team gender to pick. */
export function asSportFor(slug: string): { base: string; gender: "M" | "F" | null } | null {
  const g = /^(mens|womens)-(.+)$/.exec(slug);
  const core = g ? g[2] : slug;
  const map: Record<string, string> = {
    football: "american-football",
    basketball: "basketball",
    baseball: "baseball",
    softball: "baseball",
    "ice-hockey": "ice-hockey",
    hockey: "ice-hockey",
    soccer: "football",
    volleyball: "volleyball",
  };
  const sport = map[core];
  if (!sport) return null;
  const gender = g
    ? g[1] === "womens"
      ? "F"
      : "M"
    : core === "football" || core === "baseball"
      ? "M"
      : core === "softball"
        ? "F"
        : null;
  return { base: SPORT_BASE[sport], gender };
}

/** "Gallaudet University" → "gallaudet": the words AllSports team names start with. */
export function schoolKey(school: string): string {
  return school
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(the|university|college|of|at)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const teamSearchPath = (base: string, key: string) =>
  `${base}/search/${encodeURIComponent(key.replace(/ /g, "-").slice(0, 60))}`;
export const teamGamesPath = (base: string, teamId: number, which: "next" | "previous") =>
  `${base}/team/${teamId}/matches/${which}/0`;

const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** The school's team in an AllSports search response, matching the name and gender. */
export function pickTeam(
  search: unknown,
  key: string,
  gender: "M" | "F" | null,
): { id: number; name: string } | null {
  const results = (search as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results) || key.length < 3) return null;
  for (const r of results as Array<{ type?: unknown; entity?: Record<string, unknown> }>) {
    const e = r?.entity;
    if (r?.type !== "team" || !e?.id) continue;
    const name = clean(e.name);
    if (!schoolKey(name).startsWith(key)) continue;
    if (gender && e.gender && e.gender !== gender) continue;
    return { id: Number(e.id), name };
  }
  return null;
}

type AsSide = { id?: unknown; name?: unknown };
type AsScore = { current?: unknown; display?: unknown } | undefined;

const scoreOf = (s: AsScore): number | null => {
  const v = s?.current ?? s?.display;
  const n = Number(v);
  return v === undefined || v === null || !Number.isFinite(n) ? null : n;
};

/** One AllSports game → a SchoolEvent from the team's point of view; null if malformed. */
export function toSchoolEvent(raw: unknown, teamId: number): SchoolEvent | null {
  const e = raw as {
    id?: unknown;
    homeTeam?: AsSide;
    awayTeam?: AsSide;
    homeScore?: AsScore;
    awayScore?: AsScore;
    status?: { type?: unknown };
    startTimestamp?: unknown;
  } | null;
  if (!e?.id || !e.homeTeam || !e.awayTeam || !Number.isFinite(Number(e.startTimestamp)))
    return null;
  const home = Number(e.homeTeam.id) === teamId;
  const them = home ? e.awayTeam : e.homeTeam;
  const a = scoreOf(home ? e.homeScore : e.awayScore);
  const b = scoreOf(home ? e.awayScore : e.homeScore);
  const done = e.status?.type === "finished" && a !== null && b !== null;
  return {
    id: `as:${clean(e.id)}`,
    sport: null,
    sportId: null,
    start: new Date(Number(e.startTimestamp) * 1000).toISOString(),
    allDay: false,
    title: `${clean(e.awayTeam.name)} at ${clean(e.homeTeam.name)}`,
    opponent: clean(them.name) || null,
    home,
    location: null,
    result: done ? (a > b ? "W" : a < b ? "L" : "T") : null,
    score: done ? `${a}-${b}` : null,
    stream: null,
    url: null,
  };
}

/** Previous and next games → one season, oldest first, each game once. */
export function mergeSeason(lists: unknown[], teamId: number): SchoolEvent[] {
  const seen = new Set<string>();
  const out: SchoolEvent[] = [];
  for (const list of lists) {
    const events = (list as { events?: unknown[] } | null)?.events;
    if (!Array.isArray(events)) continue;
    for (const raw of events) {
      const ev = toSchoolEvent(raw, teamId);
      if (!ev || seen.has(ev.id)) continue;
      seen.add(ev.id);
      out.push(ev);
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}
