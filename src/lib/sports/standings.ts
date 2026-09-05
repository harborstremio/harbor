import { safeFetch } from "@/lib/safe-fetch";
import { LEAGUES, type LeagueDef } from "./espn";

const BASE = "https://site.web.api.espn.com/apis/v2/sports";
const TTL = 300_000;

export type StandingsCell = {
  name: string;
  label: string;
  abbr: string;
  value: number | null;
  display: string;
};

export type StandingsColumn = { name: string; label: string; abbr: string };

export type StandingsRow = {
  teamId: string;
  name: string;
  shortName: string;
  abbr: string;
  logo: string;
  rank: number;
  note: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  points: number | null;
  scoredFor: number | null;
  scoredAgainst: number | null;
  difference: number | null;
  record: string;
  streak: string;
  cells: StandingsCell[];
};

export type StandingsGroup = { id: string; name: string; rows: StandingsRow[] };

export type StandingsTable = {
  leagueTag: string;
  leagueName: string;
  sport: string;
  season: string;
  columns: StandingsColumn[];
  groups: StandingsGroup[];
};

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const COLUMN_ORDER = [
  "rank",
  "playoffSeed",
  "gamesPlayed",
  "matchesPlayed",
  "wins",
  "gamesWon",
  "matchesWon",
  "ties",
  "gamesDrawn",
  "tiegames",
  "matchesDraw",
  "matchesTied",
  "losses",
  "gamesLost",
  "matchesLost",
  "otLosses",
  "overtimeLosses",
  "OTLosses",
  "noresult",
  "pointsFor",
  "pointsAgainst",
  "pointDifferential",
  "pointsDifference",
  "differential",
  "points",
  "matchPoints",
  "championshipPts",
  "ppg",
  "winPercent",
  "gamesBehind",
  "streak",
  "overall",
  "Total",
];

const PICK = {
  played: ["gamesPlayed", "matchesPlayed"],
  wins: ["wins", "gamesWon", "matchesWon"],
  draws: ["ties", "gamesDrawn", "tiegames", "matchesDraw", "matchesTied"],
  losses: ["losses", "gamesLost", "matchesLost"],
  points: ["points", "matchPoints", "championshipPts"],
  scoredFor: ["pointsFor"],
  scoredAgainst: ["pointsAgainst"],
  difference: ["pointDifferential", "pointsDifference", "differential"],
} as const;

function defForTag(leagueTag: string) {
  return LEAGUES.find((l) => l.tag === leagueTag) ?? null;
}

function toCell(raw: Raw): StandingsCell | null {
  const name = str(raw.name);
  if (!name) return null;
  const value = num(raw.value);
  const display = str(raw.displayValue);
  if (!display && value == null) return null;
  return {
    name,
    label: str(raw.displayName) || str(raw.shortDisplayName) || name,
    abbr: str(raw.abbreviation) || str(raw.shortDisplayName) || name,
    value,
    display: display || (value != null ? String(value) : ""),
  };
}

function pickNumber(cells: StandingsCell[], names: readonly string[]): number | null {
  for (const n of names) {
    const cell = cells.find((c) => c.name === n);
    if (!cell) continue;
    if (cell.value != null) return cell.value;
    const parsed = Number(cell.display.replace(/[+,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickDisplay(cells: StandingsCell[], names: readonly string[]): string {
  for (const n of names) {
    const cell = cells.find((c) => c.name === n);
    if (cell?.display) return cell.display;
  }
  return "";
}

export function rowStat(row: StandingsRow, names: readonly string[]): string {
  return pickDisplay(row.cells, names);
}

function toRow(entry: Raw, index: number): StandingsRow | null {
  const team = obj(entry.team);
  const athlete = obj(entry.athlete);
  const isAthlete = !str(team.displayName) && !str(team.name) && !!str(athlete.displayName);
  const subject = isAthlete ? athlete : team;
  const name = str(subject.displayName) || str(subject.name);
  if (!name) return null;
  const cells = arr(entry.stats)
    .map(toCell)
    .filter((c): c is StandingsCell => c !== null);
  const note = obj(entry.note);
  const seeded = pickNumber(cells, ["rank", "playoffSeed"]);
  const logos = arr(subject.logos);
  const flag = obj(subject.flag);
  const headshot = obj(subject.headshot);
  return {
    teamId: str(subject.id),
    name,
    shortName: str(subject.shortDisplayName) || str(subject.shortName) || name,
    abbr: str(subject.abbreviation),
    logo: isAthlete
      ? str(headshot.href) || str(flag.href)
      : str(team.logo) || str(logos[0]?.href),
    rank: seeded != null && seeded > 0 ? seeded : index + 1,
    note: str(note.description),
    played: pickNumber(cells, PICK.played),
    wins: pickNumber(cells, PICK.wins),
    draws: pickNumber(cells, PICK.draws),
    losses: pickNumber(cells, PICK.losses),
    points: pickNumber(cells, PICK.points),
    scoredFor: pickNumber(cells, PICK.scoredFor),
    scoredAgainst: pickNumber(cells, PICK.scoredAgainst),
    difference: pickNumber(cells, PICK.difference),
    record: pickDisplay(cells, ["overall", "Total"]),
    streak: pickDisplay(cells, ["streak"]),
    cells,
  };
}

function orderColumns(groups: StandingsGroup[]): StandingsColumn[] {
  const seen = new Map<string, StandingsColumn>();
  for (const g of groups) {
    for (const row of g.rows) {
      for (const cell of row.cells) {
        if (!seen.has(cell.name))
          seen.set(cell.name, { name: cell.name, label: cell.label, abbr: cell.abbr });
      }
    }
  }
  const rankOf = (name: string) => {
    const i = COLUMN_ORDER.indexOf(name);
    return i === -1 ? COLUMN_ORDER.length : i;
  };
  return [...seen.values()].sort((a, b) => rankOf(a.name) - rankOf(b.name));
}

function toGroup(source: Raw, index: number, fallbackName: string): StandingsGroup | null {
  const rows = arr(obj(source.standings).entries)
    .map(toRow)
    .filter((r): r is StandingsRow => r !== null)
    .sort((a, b) => a.rank - b.rank);
  if (rows.length === 0) return null;
  return {
    id: str(source.id) || String(index),
    name: str(source.name) || str(source.abbreviation) || fallbackName,
    rows,
  };
}

function parseTable(data: Raw, def: LeagueDef): StandingsTable | null {
  const leagueName = str(data.name) || str(data.abbreviation) || def.labelEn;
  const children = arr(data.children);
  const flat = obj(data.standings);
  let sources = children;
  let groups = children
    .map((child, i) => toGroup(child, i, leagueName))
    .filter((g): g is StandingsGroup => g !== null);
  if (groups.length === 0) {
    sources = [{ id: flat.id, name: leagueName, standings: flat }];
    groups = sources
      .map((source, i) => toGroup(source, i, leagueName))
      .filter((g): g is StandingsGroup => g !== null);
  }
  if (groups.length === 0) return null;
  const season = obj(data.season);
  const firstStandings = obj(sources[0]?.standings);
  return {
    leagueTag: def.tag,
    leagueName,
    sport: def.group,
    season: str(season.displayName) || str(firstStandings.seasonDisplayName) || str(season.year),
    columns: orderColumns(groups),
    groups,
  };
}

const cache = new Map<string, { at: number; table: StandingsTable | null }>();
const inflight = new Map<string, Promise<StandingsTable | null>>();

async function fetchStandingsRaw(leagueTag: string, season?: number): Promise<StandingsTable | null> {
  const def = defForTag(leagueTag);
  if (!def) return null;
  const query = season ? `?season=${season}` : "";
  const res = await safeFetch(`${BASE}/${def.path}/standings${query}`);
  if (!res.ok) return null;
  const data = (await res.json()) as Raw;
  return parseTable(data, def);
}

export function fetchStandings(leagueTag: string, season?: number): Promise<StandingsTable | null> {
  const key = season ? `${leagueTag}@${season}` : leagueTag;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.table);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetchStandingsRaw(leagueTag, season)
    .then((table) => {
      cache.set(key, { at: Date.now(), table });
      return table;
    })
    .catch(() => cache.get(key)?.table ?? null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function findStandingsRow(
  table: StandingsTable | null,
  teamId: string,
): { group: StandingsGroup; row: StandingsRow } | null {
  if (!table || !teamId) return null;
  for (const group of table.groups) {
    const row = group.rows.find((r) => r.teamId === teamId);
    if (row) return { group, row };
  }
  return null;
}
