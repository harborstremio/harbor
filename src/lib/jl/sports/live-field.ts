/**
 * Live field data, from ESPN's game summary (US football, NFL and college) and the match roster
 * (soccer). Plain parsers, no I/O. Positions are schematic: ESPN publishes the ball spot and the
 * lineup, not player tracking coordinates.
 */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const idOf = (v: unknown): string | null =>
  str(v) ?? (typeof v === "number" ? String(v) : null) ?? str(rec(v).id);

export type FootballSituation = {
  /** Abbreviation of the team with the ball. */
  offense: string;
  defense: string;
  /** True when the home team has the ball. */
  offenseIsHome: boolean;
  /** Ball spot in yards from the offense's own goal line (0–100). */
  ballYard: number;
  /** First-down line in the same frame; null on "& Goal" or when unknown. */
  firstDownYard: number | null;
  /** "2nd & 7 at KC 25". */
  downText: string | null;
  redZone: boolean;
  lastPlay: string | null;
  /** The drive in progress: "7 plays, 48 yards, 3:12". */
  drive: string | null;
  /** Where the drive started: "KC 25". */
  driveStart: string | null;
  /** How the previous drive ended: "Touchdown", "Punt". */
  previousDrive: string | null;
  timeouts: { home: number; away: number } | null;
  /** Team colours as "#rrggbb", kept apart from each other and readable on a dark field. */
  offenseColor: string;
  defenseColor: string;
};

/**
 * "KC 25" with KC on offense is the offense's own 25 (25 yards out); "BUF 40" with KC on offense
 * is 40 yards from BUF's goal (60 yards out). "50" is midfield. With `defenseAbbr`, a spot naming
 * neither team is rejected rather than guessed onto the defense's half.
 */
export function yardsFromOwnGoal(
  possessionText: string,
  offenseAbbr: string,
  defenseAbbr?: string,
): number | null {
  const m = /^\s*([A-Za-z.&'-]+)?\s*(\d{1,2})\s*$/.exec(possessionText);
  if (!m) return null;
  const yard = Number(m[2]);
  if (yard < 0 || yard > 50) return null;
  if (!m[1] || yard === 50) return yard;
  const side = m[1].toUpperCase();
  if (side === offenseAbbr.toUpperCase()) return yard;
  if (defenseAbbr && side !== defenseAbbr.toUpperCase()) return null;
  return 100 - yard;
}

/**
 * Left-to-right position (0–100) on a field drawn with the away end zone on the left and the home
 * end zone on the right, so it does not flip on every change of possession: the away offense
 * drives right, the home offense drives left.
 */
export function fieldX(yardFromOwnGoal: number, offenseIsHome: boolean): number {
  return offenseIsHome ? 100 - yardFromOwnGoal : yardFromOwnGoal;
}

function hex(v: unknown): string | null {
  const s = str(v)?.replace(/^#/, "");
  return s && /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
}

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(color.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorDistance(a: string, b: string): number {
  return [1, 3, 5].reduce(
    (sum, i) => sum + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)),
    0,
  );
}

export type TeamColorInput = { color?: string | null; alternateColor?: string | null };

const HOME_FALLBACK = "#38bdf8";
const AWAY_FALLBACK = "#f8fafc";

/**
 * Home and away colours that read on a dark overlay and differ from each other: a near-black
 * colour gives way to the alternate, and an away colour too close to home's does too.
 */
export function sideColors(
  home: TeamColorInput,
  away: TeamColorInput,
): { home: string; away: string } {
  const readable = (c: string | null) => (c && luminance(c) >= 0.03 ? c : null);
  const h = readable(hex(home.color)) ?? readable(hex(home.alternateColor)) ?? HOME_FALLBACK;
  const a =
    [hex(away.color), hex(away.alternateColor), AWAY_FALLBACK, HOME_FALLBACK]
      .map(readable)
      .find((c): c is string => !!c && colorDistance(c, h) >= 120) ?? AWAY_FALLBACK;
  return { home: h, away: a };
}

/** The summary header's home and away competitors. */
export function headerSides(summary: unknown): { home: Rec | null; away: Rec | null } {
  const comp = arr(rec(rec(summary).header).competitions)[0];
  const cs = arr(comp?.competitors);
  return {
    home: cs.find((c) => c.homeAway === "home") ?? cs[0] ?? null,
    away: cs.find((c) => c.homeAway === "away") ?? cs[1] ?? null,
  };
}

export function teamColors(summary: unknown): { home: string; away: string } {
  const { home, away } = headerSides(summary);
  const colors = (c: Rec | null): TeamColorInput => {
    const t = rec(c?.team);
    return { color: str(t.color), alternateColor: str(t.alternateColor) };
  };
  return sideColors(colors(home), colors(away));
}

export function parseFootballSituation(
  summary: unknown,
  teams: { home: { id?: string; abbr: string }; away: { id?: string; abbr: string } },
): FootballSituation | null {
  const d = rec(summary);
  const comp = arr(rec(d.header).competitions)[0] ?? {};
  const s = Object.keys(rec(d.situation)).length ? rec(d.situation) : rec(comp.situation);
  const drives = rec(d.drives);
  const current = rec(drives.current);
  const currentPlays = arr(current.plays);
  const lastDrivePlay = currentPlays.at(-1) ?? null;
  const lastEnd = rec(lastDrivePlay?.end);
  const lastPrevious = arr(drives.previous).at(-1) ?? null;

  // Between snaps the summary can drop its situation; the drive in progress still has the spot.
  const driveTeam = idOf(current.team) ?? idOf(lastEnd.team);
  const possessionId = idOf(s.possession) ?? driveTeam;
  const offenseIsHome =
    possessionId && possessionId === teams.home.id
      ? true
      : possessionId && possessionId === teams.away.id
        ? false
        : null;
  if (offenseIsHome == null) return null;
  const offense = offenseIsHome ? teams.home.abbr : teams.away.abbr;
  const defense = offenseIsHome ? teams.away.abbr : teams.home.abbr;
  const situationHasSpot = str(s.possessionText) != null || num(s.yardsToEndzone) != null;
  const spot = situationHasSpot || driveTeam !== possessionId ? s : lastEnd;
  const possessionText = str(spot.possessionText);
  const toEndzone = num(spot.yardsToEndzone);
  const ballYard =
    (possessionText ? yardsFromOwnGoal(possessionText, offense, defense) : null) ??
    (toEndzone != null && toEndzone >= 0 && toEndzone <= 100 ? 100 - toEndzone : null);
  if (ballYard == null) return null;
  const yardsToGo = num(spot.distance);
  const downText = str(spot.downDistanceText) ?? str(spot.shortDownDistanceText);
  const goalToGo = /goal/i.test(downText ?? "");
  const firstDownYard =
    !goalToGo && yardsToGo != null && yardsToGo > 0 ? Math.min(100, ballYard + yardsToGo) : null;
  const lastPlay =
    str(rec(s.lastPlay).text) ??
    str(lastDrivePlay?.text) ??
    str(arr(lastPrevious?.plays).at(-1)?.text);
  const homeTimeouts = num(s.homeTimeouts);
  const awayTimeouts = num(s.awayTimeouts);
  const colors = teamColors(summary);
  return {
    offense,
    defense,
    offenseIsHome,
    ballYard,
    firstDownYard,
    downText,
    redZone: s.isRedZone === true || ballYard >= 80,
    lastPlay,
    drive: str(current.description),
    driveStart: str(rec(current.start).text),
    previousDrive: str(lastPrevious?.displayResult) ?? str(lastPrevious?.result),
    timeouts:
      homeTimeouts != null && awayTimeouts != null
        ? { home: homeTimeouts, away: awayTimeouts }
        : null,
    offenseColor: offenseIsHome ? colors.home : colors.away,
    defenseColor: offenseIsHome ? colors.away : colors.home,
  };
}

export type PitchPlayer = {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  substitutedIn: boolean;
  substitutedOut: boolean;
  goals: number;
  yellowCards: number;
  redCards: number;
};

// ESPN soccer positions: G, CD-L, LB, LWB, DM, CM, AM, LM, LW, CF, F… Wing-backs defend;
// anything with M is midfield ("DM" included); wingers and strikers attack.
const LINE = (position: string): "G" | "D" | "M" | "F" => {
  const p = position.toUpperCase();
  if (p.startsWith("G")) return "G";
  if (p.includes("WB")) return "D";
  if (p.includes("M")) return "M";
  if (p.includes("F") || p.includes("S") || p.includes("W") || p === "A") return "F";
  return "D";
};

/**
 * Who is on the pitch now: starters still on, with each substitute taking a replaced starter's
 * place in the same line when possible; red-carded players are off.
 */
export function activeLineup(roster: PitchPlayer[]): PitchPlayer[] {
  const starters = roster.filter((p) => p.starter);
  const subsIn = roster.filter((p) => !p.starter && p.substitutedIn);
  const lineup: PitchPlayer[] = [];
  const unused = [...subsIn];
  for (const p of starters) {
    if (!p.substitutedOut) {
      lineup.push(p);
      continue;
    }
    const sameLine = unused.findIndex((s) => LINE(s.position) === LINE(p.position));
    const pick = sameLine >= 0 ? unused.splice(sameLine, 1)[0] : unused.shift();
    if (pick) lineup.push(pick);
  }
  lineup.push(...unused);
  return lineup.filter((p) => p.redCards === 0).slice(0, 11);
}

/** Rows from the goalkeeper forward, following the formation ("4-3-3") when it fits. */
export function pitchRows(lineup: PitchPlayer[], formation: string): PitchPlayer[][] {
  const keeper = lineup.find((p) => LINE(p.position) === "G") ?? lineup[0];
  const outfield = lineup.filter((p) => p !== keeper);
  const counts = formation
    .split("-")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const rows: PitchPlayer[][] = keeper ? [[keeper]] : [];
  if (counts.length && counts.reduce((a, b) => a + b, 0) === outfield.length) {
    let offset = 0;
    for (const c of counts) {
      rows.push(outfield.slice(offset, offset + c));
      offset += c;
    }
    return rows;
  }
  for (const line of ["D", "M", "F"] as const) {
    const row = outfield.filter((p) => LINE(p.position) === line);
    if (row.length) rows.push(row);
  }
  return rows;
}
