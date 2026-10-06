/**
 * Live field data, from ESPN's game summary (US football) and Harbor's match roster (soccer).
 * Plain parsers, no I/O. Positions are schematic: ESPN publishes the ball spot and the lineup,
 * not player tracking coordinates.
 */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export type FootballSituation = {
  /** Abbreviation of the team with the ball. */
  offense: string;
  defense: string;
  /** Ball spot in yards from the offense's own goal line (0–100). */
  ballYard: number;
  /** First-down line in the same frame; null on "& Goal" or when unknown. */
  firstDownYard: number | null;
  /** "2nd & 7 at KC 25". */
  downText: string | null;
  redZone: boolean;
  lastPlay: string | null;
};

/**
 * "KC 25" with KC on offense is the offense's own 25 (25 yards out); "BUF 40" with KC on offense
 * is 40 yards from BUF's goal (60 yards out). "50" is midfield.
 */
export function yardsFromOwnGoal(possessionText: string, offenseAbbr: string): number | null {
  const m = /^\s*([A-Za-z.&'-]+)?\s*(\d{1,2})\s*$/.exec(possessionText);
  if (!m) return null;
  const yard = Number(m[2]);
  if (yard < 0 || yard > 50) return null;
  if (!m[1] || yard === 50) return yard;
  return m[1].toUpperCase() === offenseAbbr.toUpperCase() ? yard : 100 - yard;
}

export function parseFootballSituation(
  summary: unknown,
  teams: { home: { id?: string; abbr: string }; away: { id?: string; abbr: string } },
): FootballSituation | null {
  const d = rec(summary);
  const comp = rec((Array.isArray(rec(d.header).competitions) ? (rec(d.header).competitions as unknown[]) : [])[0]);
  const s = Object.keys(rec(d.situation)).length ? rec(d.situation) : rec(comp.situation);
  const possessionId = str(s.possession) ?? str(rec(s.possession).id);
  const offenseIsHome =
    possessionId && possessionId === teams.home.id
      ? true
      : possessionId && possessionId === teams.away.id
        ? false
        : null;
  if (offenseIsHome == null) return null;
  const offense = offenseIsHome ? teams.home.abbr : teams.away.abbr;
  const defense = offenseIsHome ? teams.away.abbr : teams.home.abbr;
  const possessionText = str(s.possessionText);
  const ballYard = possessionText ? yardsFromOwnGoal(possessionText, offense) : null;
  if (ballYard == null) return null;
  const distance = num(s.distance);
  const downText = str(s.downDistanceText) ?? str(s.shortDownDistanceText);
  const goalToGo = /goal/i.test(downText ?? "");
  const firstDownYard = !goalToGo && distance != null ? Math.min(100, ballYard + distance) : null;
  const lastPlay = str(rec(s.lastPlay).text);
  return {
    offense,
    defense,
    ballYard,
    firstDownYard,
    downText,
    redZone: s.isRedZone === true || ballYard >= 80,
    lastPlay,
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
