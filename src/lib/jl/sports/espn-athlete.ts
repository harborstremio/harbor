/** ESPN athlete pages: profile, season stats and game log. Plain parsers, no I/O. */
import type { SportsGame } from "../../sports/espn.ts";
import type { JlFavoritePlayer } from "./favorites.ts";
import { parseAthleteForFollow } from "./search-parse.ts";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
const https = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.replace(/^http:\/\//, "https://") : null;
};
const hex = (v: unknown): string | null => {
  const s = str(v);
  return s && /^[0-9a-f]{6}$/i.test(s) ? s : null;
};

export type AthleteStat = { label: string; value: string; rank: string | null };

export type AthleteProfile = {
  id: string;
  name: string;
  headshot: string | null;
  position: string | null;
  jersey: string | null;
  team: { id: string; name: string; logo: string | null; color: string | null } | null;
  bio: Array<{ label: string; value: string }>;
  statsLabel: string | null;
  stats: AthleteStat[];
  /** What Follow stores. */
  follow: Omit<JlFavoritePlayer, "league" | "id" | "name">;
};

export function parseAthlete(doc: unknown): AthleteProfile | null {
  const a = rec(rec(doc).athlete);
  const id = str(a.id);
  const name = str(a.displayName) ?? str(a.fullName);
  if (!id || !name) return null;
  const team = rec(a.team);
  const teamId = str(team.id);
  const teamName = str(team.displayName) ?? str(team.name);
  const bio: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null) => {
    if (value) bio.push({ label, value });
  };
  const hw = [str(a.displayHeight), str(a.displayWeight)].filter(Boolean).join(", ");
  push("Height, weight", hw || null);
  push("Age", str(a.age));
  push("Born", str(a.displayDOB));
  push("Birthplace", str(a.displayBirthPlace) ?? str(rec(a.birthPlace).displayText));
  push("College", str(rec(a.college).name));
  push("Draft", str(a.displayDraft));
  push("Experience", str(a.displayExperience));
  push("Bats/throws", str(a.displayBatsThrows));
  push("Nationality", str(a.citizenship));
  const summary = rec(a.statsSummary);
  const stats = arr(summary.statistics)
    .map((s) => ({
      label: str(s.displayName) ?? str(s.shortDisplayName) ?? str(s.abbreviation) ?? "",
      value: str(s.displayValue) ?? "",
      rank: str(s.rankDisplayValue),
    }))
    .filter((s) => s.label && s.value);
  const position = rec(a.position);
  return {
    id,
    name,
    headshot: https(rec(a.headshot).href),
    position: str(position.displayName) ?? str(position.abbreviation),
    jersey: str(a.displayJersey) ?? (str(a.jersey) ? `#${str(a.jersey)}` : null),
    team: teamId && teamName ? { id: teamId, name: teamName, logo: https(arr(team.logos)[0]?.href) ?? https(team.logo), color: hex(team.color) } : null,
    bio,
    statsLabel: str(summary.displayName),
    stats,
    follow: parseAthleteForFollow(doc),
  };
}

export type GameLogRow = {
  eventId: string;
  startMs: number;
  /** "vs" or "@". */
  atVs: string;
  opponent: { id: string | null; name: string; abbr: string; logo: string | null };
  result: string | null;
  score: string | null;
  stats: string[];
  game: SportsGame | null;
};

export type GameLog = { label: string | null; columns: string[]; rows: GameLogRow[] };

/**
 * ESPN's game log: column labels at the top, game details keyed by event id, and per-season-type
 * categories (months or "regular season") listing each event's stat line. The newest season type comes first.
 */
export function parseGameLog(doc: unknown, league: string, limit = 15): GameLog {
  const d = rec(doc);
  const columns = (Array.isArray(d.labels) ? d.labels : []).map((l) => str(l) ?? "");
  const events = rec(d.events);
  const seasonType = arr(d.seasonTypes)[0];
  const lines = new Map<string, string[]>();
  for (const cat of arr(seasonType?.categories)) {
    for (const e of arr(cat.events)) {
      const id = str(e.eventId);
      if (!id || lines.has(id)) continue;
      lines.set(id, (Array.isArray(e.stats) ? e.stats : []).map((s) => str(s) ?? "-"));
    }
  }
  const ids = lines.size > 0 ? [...lines.keys()] : Object.keys(events);
  const rows: GameLogRow[] = [];
  for (const id of ids) {
    const e = rec(events[id]);
    if (!str(e.id) && !Object.keys(e).length) continue;
    const opp = rec(e.opponent);
    const startMs = Date.parse(str(e.gameDate) ?? "") || 0;
    rows.push({
      eventId: id,
      startMs,
      atVs: str(e.atVs) ?? "",
      opponent: {
        id: str(opp.id),
        name: str(opp.displayName) ?? str(opp.abbreviation) ?? "",
        abbr: str(opp.abbreviation) ?? "",
        logo: https(opp.logo),
      },
      result: str(e.gameResult),
      score: str(e.score),
      stats: lines.get(id) ?? [],
      game: gameFromLog(id, e, league, startMs),
    });
  }
  rows.sort((a, b) => b.startMs - a.startMs);
  return { label: str(seasonType?.displayName), columns, rows: rows.slice(0, limit) };
}

function gameFromLog(id: string, e: Rec, league: string, startMs: number): SportsGame | null {
  if (!/^\d{1,12}$/.test(id)) return null;
  const team = rec(e.team);
  const opp = rec(e.opponent);
  const teamId = str(team.id);
  const oppId = str(opp.id);
  const homeId = str(e.homeTeamId);
  if (!teamId || !oppId || !homeId) return null;
  const won = e.gameResult === "W";
  const lost = e.gameResult === "L";
  const side = (t: Rec, tid: string, winner: boolean) => ({
    id: tid,
    name: str(t.displayName) ?? str(t.abbreviation) ?? "",
    abbr: str(t.abbreviation) ?? "",
    logo: https(t.logo) ?? "",
    score: str(tid === homeId ? e.homeTeamScore : e.awayTeamScore) ?? "",
    winner,
  });
  const mine = side(team, teamId, won);
  const theirs = side(opp, oppId, lost);
  const home = homeId === teamId ? mine : theirs;
  const away = homeId === teamId ? theirs : mine;
  return { id, league, state: "post", detail: "Final", home, away, startMs };
}

/** Game-log games know the athlete's team only by abbreviation; fill in its full name and logo. */
export function withTeamDetails(
  game: SportsGame,
  team: { id: string; name: string; logo: string | null } | null,
): SportsGame {
  if (!team) return game;
  const fill = (s: SportsGame["home"]) => (s.id === team.id ? { ...s, name: team.name, logo: s.logo || team.logo || "" } : s);
  return { ...game, home: fill(game.home), away: fill(game.away) };
}
