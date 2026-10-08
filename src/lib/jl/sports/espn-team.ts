/**
 * ESPN team pages: the team header, its roster and its leaders (from a game summary).
 * Plain parsers, no I/O.
 */
import type { SportsGame } from "../../sports/espn.ts";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
export const https = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.replace(/^http:\/\//, "https://") : null;
};
const hex = (v: unknown): string | null => {
  const s = str(v);
  return s && /^[0-9a-f]{6}$/i.test(s) ? s : null;
};

export type TeamInfo = {
  id: string;
  name: string;
  /** School or city ("Kansas City"). */
  location: string | null;
  /** Mascot ("Chiefs"). */
  nickname: string | null;
  abbr: string;
  logo: string | null;
  /** Hex without '#'. */
  color: string | null;
  record: string | null;
  /** "1st in AFC West". */
  standing: string | null;
  venue: string | null;
};

export function parseTeamInfo(doc: unknown): TeamInfo | null {
  const t = rec(rec(doc).team);
  const id = str(t.id);
  const name = str(t.displayName) ?? str(t.name);
  if (!id || !name) return null;
  const items = arr(rec(t.record).items);
  const total = items.find((i) => i.type === "total") ?? items[0];
  return {
    id,
    name,
    location: str(t.location),
    nickname: str(t.name),
    abbr: str(t.abbreviation) ?? "",
    logo: https(arr(t.logos)[0]?.href) ?? https(t.logo),
    color: hex(t.color),
    record: str(total?.summary),
    standing: str(t.standingSummary),
    venue: str(rec(rec(t.franchise).venue).fullName) ?? str(rec(t.venue).fullName),
  };
}

export type RosterPlayer = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  headshot: string | null;
  /** ESPN's position group ("Offense"), when the roster is grouped. */
  group: string | null;
  detail: string | null;
};

export type Roster = { players: RosterPlayer[]; coach: string | null };

/** Rosters come flat (NBA, soccer) or grouped by position (NFL, MLB). */
export function parseRoster(doc: unknown): Roster {
  const d = rec(doc);
  const players: RosterPlayer[] = [];
  const seen = new Set<string>();
  const add = (a: Rec, group: string | null) => {
    const id = str(a.id);
    const name = str(a.displayName) ?? str(a.fullName);
    if (!id || !name || seen.has(id)) return;
    seen.add(id);
    const position = rec(a.position);
    players.push({
      id,
      name,
      jersey: str(a.jersey),
      position: str(position.abbreviation) ?? str(position.displayName),
      headshot: https(rec(a.headshot).href),
      group,
      detail: [str(a.displayHeight), str(a.displayWeight), a.age != null ? str(a.age) : null]
        .filter(Boolean)
        .join(" · ") || null,
    });
  };
  for (const entry of arr(d.athletes)) {
    if (Array.isArray(entry.items)) {
      const group = str(entry.position) ?? str(entry.displayName);
      for (const a of arr(entry.items)) add(a, group ? group.charAt(0).toUpperCase() + group.slice(1) : null);
    } else {
      add(entry, null);
    }
  }
  const c = arr(d.coach)[0];
  const coach = c ? [str(c.firstName), str(c.lastName)].filter(Boolean).join(" ") || null : null;
  return { players, coach };
}

export type LeaderEntry = {
  category: string;
  athleteId: string | null;
  athlete: string;
  headshot: string | null;
  position: string | null;
  value: string;
};

/** One team's leaders in a game summary (season leaders before a game, game leaders after it). */
export function parseSummaryLeaders(summary: unknown, teamId: string): LeaderEntry[] {
  const out: LeaderEntry[] = [];
  for (const t of arr(rec(summary).leaders)) {
    if (str(rec(t.team).id) !== teamId) continue;
    for (const cat of arr(t.leaders)) {
      const top = arr(cat.leaders)[0];
      const a = rec(top?.athlete);
      const athlete = str(a.displayName) ?? str(a.shortName);
      const value = str(top?.displayValue);
      const category = str(cat.displayName) ?? str(cat.name);
      if (!athlete || !value || !category) continue;
      out.push({
        category,
        athleteId: str(a.id),
        athlete,
        headshot: https(rec(a.headshot).href),
        position: str(rec(a.position).abbreviation),
        value,
      });
    }
  }
  return out;
}

/** Upcoming games soonest first, results latest first. */
export function splitSchedule(games: SportsGame[]): { upcoming: SportsGame[]; results: SportsGame[] } {
  const upcoming = games.filter((g) => g.state !== "post").sort((a, b) => a.startMs - b.startMs);
  const results = games.filter((g) => g.state === "post").sort((a, b) => b.startMs - a.startMs);
  return { upcoming, results };
}

/** The game whose summary carries the team's leaders: the next game (season leaders), else the last one. */
export function leadersSource(games: SportsGame[]): { game: SportsGame; season: boolean } | null {
  const { upcoming, results } = splitSchedule(games);
  if (upcoming[0]) return { game: upcoming[0], season: upcoming[0].state === "pre" };
  return results[0] ? { game: results[0], season: false } : null;
}

/** W, L or T for a team in a finished game. */
export function resultFor(game: SportsGame, teamId: string): "W" | "L" | "T" | null {
  if (game.state !== "post") return null;
  const me = game.home.id === teamId ? game.home : game.away.id === teamId ? game.away : null;
  const them = me === game.home ? game.away : game.home;
  if (!me) return null;
  if (me.winner) return "W";
  if (them.winner) return "L";
  const a = Number(me.score);
  const b = Number(them.score);
  if (!me.score || !them.score || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a > b ? "W" : a < b ? "L" : "T";
}
