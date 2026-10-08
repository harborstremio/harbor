/** ESPN league pages: standings tables, the teams list and stat leaders. Plain parsers, no I/O. */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
const https = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.replace(/^http:\/\//, "https://") : null;
};
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export type StandingRow = {
  /** Team id, or the athlete id in driver/player standings. */
  id: string | null;
  kind: "team" | "athlete";
  name: string;
  abbr: string;
  logo: string | null;
  /** Stat name → display value. */
  values: Record<string, string>;
  numbers: Record<string, number>;
};

export type StandingGroup = { name: string; rows: StandingRow[] };

export type StandingColumn = { key: string; label: string };

function parseEntry(e: Rec): StandingRow | null {
  const team = rec(e.team);
  const athlete = rec(e.athlete);
  const isTeam = Object.keys(team).length > 0;
  const who = isTeam ? team : athlete;
  const name = str(who.displayName) ?? str(who.name) ?? str(who.shortName);
  if (!name) return null;
  const values: Record<string, string> = {};
  const numbers: Record<string, number> = {};
  for (const s of arr(e.stats)) {
    const key = str(s.name) ?? str(s.type);
    if (!key) continue;
    const display = str(s.displayValue) ?? str(s.summary);
    if (display != null) values[key] = display;
    const n = num(s.value);
    if (n != null) numbers[key] = n;
  }
  return {
    id: str(who.id),
    kind: isTeam ? "team" : "athlete",
    name,
    abbr: str(who.abbreviation) ?? str(who.shortName) ?? "",
    logo: https(arr(who.logos)[0]?.href) ?? https(who.logo) ?? https(rec(who.flag).href) ?? https(rec(who.headshot).href),
    values,
    numbers,
  };
}

/** Rank, seed, winning percentage, points: whichever the table carries, in that order. */
function sortRows(rows: StandingRow[]): StandingRow[] {
  const asc = (key: string) => rows.every((r) => key in r.numbers && r.numbers[key] > 0);
  const desc = (key: string) => rows.every((r) => key in r.numbers);
  const indexed = rows.map((r, i) => ({ r, i }));
  const pick = asc("rank") ? "rank" : asc("playoffSeed") ? "playoffSeed" : null;
  if (pick) return indexed.sort((a, b) => a.r.numbers[pick] - b.r.numbers[pick] || a.i - b.i).map((x) => x.r);
  const by = desc("points") ? "points" : desc("winPercent") ? "winPercent" : null;
  if (by) return indexed.sort((a, b) => b.r.numbers[by] - a.r.numbers[by] || a.i - b.i).map((x) => x.r);
  return rows;
}

/** ESPN `/apis/v2/.../standings`: the league as one table, or conferences (and divisions) as `children`. */
export function parseStandings(doc: unknown): StandingGroup[] {
  const groups: StandingGroup[] = [];
  const walk = (node: Rec, fallbackName: string) => {
    const name = str(node.name) ?? str(node.abbreviation) ?? fallbackName;
    const children = arr(node.children);
    if (children.length > 0) {
      for (const c of children) walk(c, name);
      return;
    }
    const rows = arr(rec(node.standings).entries)
      .map(parseEntry)
      .filter((r): r is StandingRow => !!r);
    if (rows.length > 0) groups.push({ name, rows: sortRows(rows) });
  };
  walk(rec(doc), "Standings");
  return groups;
}

type ColumnSpec = { key: string[]; label: string; optional?: boolean };

const SOCCER: ColumnSpec[] = [
  { key: ["gamesPlayed"], label: "GP" },
  { key: ["wins"], label: "W" },
  { key: ["ties"], label: "D" },
  { key: ["losses"], label: "L" },
  { key: ["pointsFor"], label: "GF" },
  { key: ["pointsAgainst"], label: "GA" },
  { key: ["pointDifferential", "differential"], label: "GD" },
  { key: ["points"], label: "Pts" },
];

const HOCKEY: ColumnSpec[] = [
  { key: ["gamesPlayed"], label: "GP" },
  { key: ["wins"], label: "W" },
  { key: ["losses"], label: "L" },
  { key: ["otLosses", "overtimeLosses"], label: "OTL" },
  { key: ["points"], label: "Pts" },
  { key: ["pointsFor"], label: "GF" },
  { key: ["pointsAgainst"], label: "GA" },
];

const US: ColumnSpec[] = [
  { key: ["wins"], label: "W" },
  { key: ["losses"], label: "L" },
  { key: ["ties"], label: "T", optional: true },
  { key: ["winPercent"], label: "Pct" },
  { key: ["gamesBehind"], label: "GB" },
  { key: ["pointsFor"], label: "PF" },
  { key: ["pointsAgainst"], label: "PA" },
  { key: ["differential", "pointDifferential"], label: "Diff" },
  { key: ["streak"], label: "Strk" },
];

/**
 * The columns worth showing for a league's tables (Harbor league group: "soccer", "hockey", …).
 * Only stats the rows actually carry; ties only when someone has one. Racing and other
 * athlete standings fall back to the first stats of the first row.
 */
export function standingColumns(sportGroup: string, groups: StandingGroup[]): StandingColumn[] {
  const rows = groups.flatMap((g) => g.rows);
  const spec = sportGroup === "soccer" ? SOCCER : sportGroup === "hockey" ? HOCKEY : US;
  const cols: StandingColumn[] = [];
  for (const c of spec) {
    const key = c.key.find((k) => rows.some((r) => k in r.values));
    if (!key) continue;
    if (c.optional && !rows.some((r) => (r.numbers[key] ?? 0) > 0)) continue;
    cols.push({ key, label: c.label });
  }
  if (cols.length >= 2) return cols;
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first.values)
    .filter((k) => k !== "rank")
    .slice(0, 5)
    .map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()) }));
}

/** The table that holds a team, for the team page's standings snippet. */
export function groupForTeam(groups: StandingGroup[], teamId: string): StandingGroup | null {
  return groups.find((g) => g.rows.some((r) => r.kind === "team" && r.id === teamId)) ?? null;
}

export type LeagueTeam = { id: string; name: string; abbr: string; logo: string | null };

/** ESPN `/teams`: every team in the league, by name. */
export function parseLeagueTeams(doc: unknown): LeagueTeam[] {
  const leagues = arr(arr(rec(doc).sports)[0]?.leagues);
  const out: LeagueTeam[] = [];
  for (const entry of arr(leagues[0]?.teams)) {
    const t = rec(entry.team);
    const id = str(t.id);
    const name = str(t.displayName) ?? str(t.name);
    if (!id || !name || t.isActive === false) continue;
    out.push({ id, name, abbr: str(t.abbreviation) ?? "", logo: https(arr(t.logos)[0]?.href) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export type LeagueLeader = {
  athleteId: string | null;
  /** Null until the athlete reference is resolved. */
  name: string | null;
  headshot: string | null;
  team: string | null;
  value: string;
  /** Core API reference for the athlete, when the feed does not inline them. */
  ref: string | null;
};

export type LeaderCategory = { key: string; label: string; leaders: LeagueLeader[] };

/** An athlete id from an ESPN core reference ("…/athletes/3139477?lang=en"). */
export function athleteIdFromRef(ref: unknown): string | null {
  const s = str(ref);
  return s ? (/\/athletes\/(\d{1,12})(?:[/?]|$)/.exec(s)?.[1] ?? null) : null;
}

/**
 * League leaders by category. Accepts the site API's inline athletes and the core API's references
 * (`{ athlete: { $ref } }`), keeping the top `perCategory` of each.
 */
export function parseLeaders(doc: unknown, perCategory = 5): LeaderCategory[] {
  const d = rec(doc);
  const categories = arr(rec(d.leaders).categories).length ? arr(rec(d.leaders).categories) : arr(d.categories);
  const out: LeaderCategory[] = [];
  for (const c of categories) {
    const key = str(c.name) ?? str(c.abbreviation);
    const label = str(c.displayName) ?? str(c.shortDisplayName) ?? key;
    if (!key || !label) continue;
    const leaders: LeagueLeader[] = [];
    for (const l of arr(c.leaders).slice(0, perCategory)) {
      const a = rec(l.athlete);
      const ref = https(a.$ref);
      const value = str(l.displayValue) ?? str(l.value);
      if (!value) continue;
      const team = rec(l.team ?? a.team);
      leaders.push({
        athleteId: str(a.id) ?? athleteIdFromRef(ref),
        name: str(a.displayName) ?? str(a.fullName),
        headshot: https(rec(a.headshot).href),
        team: str(team.abbreviation) ?? str(team.displayName),
        value,
        ref: str(a.displayName) ? null : ref,
      });
    }
    if (leaders.length > 0) out.push({ key, label, leaders });
  }
  return out;
}

/** A core API athlete document, to fill a referenced leader. */
export function parseCoreAthlete(doc: unknown): { name: string | null; headshot: string | null } {
  const a = rec(doc);
  return { name: str(a.displayName) ?? str(a.fullName), headshot: https(rec(a.headshot).href) };
}

/** "football/nfl" → ESPN's core API league path ("football/leagues/nfl"). */
export function corePath(sitePath: string): string | null {
  const [sport, league, ...rest] = sitePath.split("/");
  return sport && league && rest.length === 0 ? `${sport}/leagues/${league}` : null;
}
