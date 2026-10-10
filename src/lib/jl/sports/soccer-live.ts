/**
 * Live soccer from ESPN's match summary: score and clock, possession and shots, the key events
 * and commentary as one feed, goal scorers, and where the latest located event happened.
 * Plain parsers, no I/O.
 */
import { headerSides, sideColors, type PitchPlayer, type TeamColorInput } from "./live-field.ts";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const idOf = (v: unknown): string | null =>
  str(v) ?? (typeof v === "number" ? String(v) : null) ?? str(rec(v).id);

export type Side = "home" | "away";

export type SoccerTeam = {
  id: string | null;
  abbr: string;
  name: string;
  score: string;
  color: string;
};

export type SoccerEventKind =
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "yellow"
  | "red"
  | "sub"
  | "corner"
  | "shot_on_target"
  | "shot"
  | "foul"
  | "offside"
  | "period"
  | "other";

export type PitchSpot = { x: number; y: number };

export type SoccerEvent = {
  id: string;
  kind: SoccerEventKind;
  /** "23'", "45'+2'". */
  minute: string;
  side: Side | null;
  player: string | null;
  text: string;
  /**
   * Where it happened, on a pitch drawn with home attacking left to right: x 0 is home's goal
   * line, 1 is away's; y 0 is the top touchline. Null when ESPN gives no location.
   */
  spot: PitchSpot | null;
  /** Where the ball ended up (a shot's target), same frame. */
  end: PitchSpot | null;
};

export type SoccerScorer = {
  player: string;
  minute: string;
  /** The side credited with the goal (an own goal counts for the other team). */
  side: Side;
  ownGoal: boolean;
  penalty: boolean;
};

export type SoccerPair = { home: number; away: number };

export type SoccerLive = {
  home: SoccerTeam;
  away: SoccerTeam;
  state: "pre" | "in" | "post";
  /** "67'", or the status detail ("HT", "FT") when there is no running clock. */
  clock: string;
  detail: string;
  /** Percent of possession, each side 0–100. */
  possession: SoccerPair | null;
  shots: SoccerPair | null;
  shotsOnTarget: SoccerPair | null;
  corners: SoccerPair | null;
  scorers: SoccerScorer[];
  /** Newest first. */
  events: SoccerEvent[];
  /** The latest goal, card, substitution or corner. */
  lastKey: SoccerEvent | null;
  /** The latest event ESPN placed on the pitch. */
  lastSpot: SoccerEvent | null;
  /** Pressure in the last 15 minutes, -1 (all away) to 1 (all home); null with nothing to go on. */
  momentum: number | null;
  homeFormation: string | null;
  awayFormation: string | null;
  homeRoster: PitchPlayer[];
  awayRoster: PitchPlayer[];
};

const KEY_KINDS = new Set<SoccerEventKind>([
  "goal",
  "own_goal",
  "penalty_goal",
  "yellow",
  "red",
  "sub",
  "corner",
]);
const GOAL_KINDS = new Set<SoccerEventKind>(["goal", "own_goal", "penalty_goal"]);

/** ESPN's event type ("Penalty - Scored", "Shot On Target") or, failing that, commentary wording. */
export function soccerEventKind(
  typeText: string,
  text: string,
  scoringPlay = false,
): SoccerEventKind {
  const t = typeText.toLowerCase();
  const x = text.toLowerCase();
  if (t.includes("own goal") || /^own goal\b/.test(x)) return "own_goal";
  if ((t.includes("penalty") && t.includes("scored")) || (scoringPlay && /penalty/.test(t + x)))
    return "penalty_goal";
  if (scoringPlay || (/^goal\b/.test(t) && !t.includes("goal kick")) || (!t && /^goal!/.test(x)))
    return "goal";
  if (t.includes("red card") || t.includes("second yellow") || (!t && /red card/.test(x)))
    return "red";
  if (t.includes("yellow card") || (!t && /yellow card/.test(x))) return "yellow";
  if (t.includes("substitution") || (!t && /^substitution\b/.test(x))) return "sub";
  if (t.includes("corner") || (!t && /^corner\b/.test(x))) return "corner";
  if (t.includes("on target") || t.includes("saved") || (!t && /^attempt saved/.test(x)))
    return "shot_on_target";
  if (
    /shot|attempt|woodwork|post|missed|blocked/.test(t) ||
    (!t && /^attempt (missed|blocked)|hits the (post|bar)/.test(x))
  )
    return "shot";
  if (t.includes("foul") || (!t && /^foul by/.test(x))) return "foul";
  if (t.includes("offside") || (!t && /^offside\b/.test(x))) return "offside";
  if (
    /kickoff|kick off|halftime|half time|start|end|full time|first half|second half|extra time/.test(
      t,
    ) ||
    (!t && /^(first|second) half (begins|ends)|^match ends|^half-?time|^extra time/.test(x))
  )
    return "period";
  return "other";
}

/**
 * ESPN's fieldPositionX/Y run 0–1 along the acting team's attack (x 1 is the goal it attacks) and
 * across the pitch; some feeds use 0–100, and 0/0 means "not recorded". Flipped for the away
 * side onto a pitch where home attacks left to right.
 */
export function pitchSpot(xRaw: unknown, yRaw: unknown, side: Side | null): PitchSpot | null {
  let x = num(xRaw);
  let y = num(yRaw);
  if (x == null || y == null || side == null) return null;
  if (x === 0 && y === 0) return null;
  if (x > 1 || y > 1) {
    x /= 100;
    y /= 100;
  }
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return side === "home" ? { x, y } : { x: 1 - x, y: 1 - y };
}

function pair(home: number | null, away: number | null): SoccerPair | null {
  return home != null && away != null ? { home, away } : null;
}

function teamOf(c: Rec | null, color: string): SoccerTeam {
  const t = rec(c?.team);
  return {
    id: idOf(t.id),
    abbr: str(t.abbreviation) ?? str(t.shortDisplayName) ?? "",
    name: str(t.displayName) ?? str(t.name) ?? "",
    score: str(c?.score) ?? (typeof c?.score === "number" ? String(c.score) : ""),
    color,
  };
}

function parseRoster(entry: Rec | undefined): PitchPlayer[] {
  return arr(entry?.roster).map((p) => {
    const athlete = rec(p.athlete);
    const stat = (name: string) => num(arr(p.stats).find((s) => s.name === name)?.value) ?? 0;
    return {
      id: idOf(athlete.id) ?? "",
      name: str(athlete.displayName) ?? "",
      jersey: str(p.jersey) ?? str(athlete.jersey) ?? "",
      position: str(rec(p.position).abbreviation) ?? str(rec(athlete.position).abbreviation) ?? "",
      starter: p.starter === true,
      substitutedIn: p.subbedIn === true || p.substitutedIn === true,
      substitutedOut: p.subbedOut === true || p.substitutedOut === true,
      goals: stat("totalGoals") || stat("goals"),
      yellowCards: stat("yellowCards"),
      redCards: stat("redCards"),
    };
  });
}

type RawEvent = SoccerEvent & { order: number; clockSeconds: number | null };

// Commentary entries sort after key events at the same game second.
const COMMENTARY = 10_000;

export function parseSoccerLive(summary: unknown): SoccerLive | null {
  const d = rec(summary);
  const comp = arr(rec(d.header).competitions)[0] ?? {};
  const sides = headerSides(summary);
  if (!sides.home || !sides.away) return null;
  const colorInput = (c: Rec | null): TeamColorInput => ({
    color: str(rec(c?.team).color),
    alternateColor: str(rec(c?.team).alternateColor),
  });
  const colors = sideColors(colorInput(sides.home), colorInput(sides.away));
  const home = teamOf(sides.home, colors.home);
  const away = teamOf(sides.away, colors.away);

  const names: Array<[Side, string]> = [];
  for (const [side, c] of [
    ["home", sides.home],
    ["away", sides.away],
  ] as const) {
    const t = rec(c.team);
    for (const n of [t.displayName, t.shortDisplayName, t.name, t.location, t.abbreviation]) {
      const s = str(n);
      if (s) names.push([side, s.toLowerCase()]);
    }
  }
  const sideOfTeam = (team: unknown): Side | null => {
    const id = idOf(team);
    if (id && id === home.id) return "home";
    if (id && id === away.id) return "away";
    const name = (str(rec(team).displayName) ?? str(rec(team).name) ?? str(team))?.toLowerCase();
    return (name && names.find(([, n]) => n === name)?.[0]) || null;
  };
  // Commentary without a team: "Corner,  Arsenal." or "Bukayo Saka (Arsenal) …".
  const sideFromText = (text: string): Side | null => {
    const t = text.toLowerCase();
    const lead = /^[a-z -]+,\s+([^.]+)\./.exec(t)?.[1]?.trim();
    const paren = /\(([^)]+)\)/.exec(t)?.[1]?.trim();
    for (const candidate of [paren, lead]) {
      const hit = candidate && names.find(([, n]) => n === candidate);
      if (hit) return hit[0];
    }
    return null;
  };

  const raw: RawEvent[] = [];
  const seen = new Set<string>();
  const add = (e: Rec, fallbackText: string | null, timeDisplay: unknown, order: number) => {
    const id = idOf(e.id);
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    const text = str(e.text) ?? str(e.shortText) ?? fallbackText ?? "";
    const typeText = str(rec(e.type).text) ?? str(rec(e.type).type) ?? "";
    const kind = soccerEventKind(typeText, text, e.scoringPlay === true);
    const side = sideOfTeam(e.team) ?? sideFromText(text);
    const clock = rec(e.clock);
    const minute = str(clock.displayValue) ?? str(timeDisplay) ?? "";
    // Commentary repeats key events under its own ids; keep the key event.
    const repeat = (r: RawEvent) =>
      r.order < COMMENTARY && r.kind === kind && r.side === side && r.minute === minute;
    if (order >= COMMENTARY && raw.some(repeat)) return;
    raw.push({
      id: id ?? `c${order}`,
      kind,
      minute,
      side,
      player: str(rec(arr(e.participants)[0]?.athlete).displayName),
      text,
      spot: pitchSpot(e.fieldPositionX, e.fieldPositionY, side),
      end: pitchSpot(e.fieldPosition2X, e.fieldPosition2Y, side),
      order,
      clockSeconds: num(clock.value),
    });
  };
  arr(d.keyEvents).forEach((e, i) => add(e, null, null, i));
  arr(d.commentary).forEach((c, i) => {
    const play = rec(c.play);
    const time = rec(c.time);
    const order = COMMENTARY + (num(c.sequence) ?? i);
    if (Object.keys(play).length) {
      add(
        { ...play, clock: Object.keys(rec(play.clock)).length ? play.clock : c.time },
        str(c.text),
        time.displayValue,
        order,
      );
    } else {
      add({ text: c.text, clock: c.time }, null, time.displayValue, order);
    }
  });
  // Game time first; within the same second, the source's own order.
  raw.sort((a, b) => {
    if (a.clockSeconds != null && b.clockSeconds != null && a.clockSeconds !== b.clockSeconds)
      return a.clockSeconds - b.clockSeconds;
    return a.order - b.order;
  });

  const events: SoccerEvent[] = raw
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      minute: e.minute,
      side: e.side,
      player: e.player,
      text: e.text,
      spot: e.spot,
      end: e.end,
    }))
    .reverse();

  const scorers: SoccerScorer[] = [];
  for (const e of raw) {
    if (!GOAL_KINDS.has(e.kind) || !e.side) continue;
    const ownGoal = e.kind === "own_goal";
    scorers.push({
      player: e.player ?? "",
      minute: e.minute,
      side: ownGoal ? (e.side === "home" ? "away" : "home") : e.side,
      ownGoal,
      penalty: e.kind === "penalty_goal",
    });
  }

  // Momentum: goals, shots and corners in the last 15 minutes of game time.
  const latest = raw.reduce<number | null>(
    (m, e) => (e.clockSeconds != null ? Math.max(m ?? 0, e.clockSeconds) : m),
    null,
  );
  const weight: Partial<Record<SoccerEventKind, number>> = {
    goal: 3,
    penalty_goal: 3,
    shot_on_target: 2,
    shot: 1,
    corner: 1,
  };
  let homeP = 0;
  let awayP = 0;
  if (latest != null) {
    for (const e of raw) {
      const w = weight[e.kind];
      if (!w || !e.side || e.clockSeconds == null || latest - e.clockSeconds > 15 * 60) continue;
      if (e.side === "home") homeP += w;
      else awayP += w;
    }
  }

  const boxTeams = arr(rec(d.boxscore).teams);
  const box = (side: Side, team: SoccerTeam) =>
    boxTeams.find((b) => team.id != null && idOf(rec(b.team).id) === team.id) ??
    boxTeams.find((b) => b.homeAway === side);
  const homeBox = box("home", home);
  const awayBox = box("away", away);
  const stat = (b: Rec | undefined, names: string[]): number | null => {
    for (const n of names) {
      const s = arr(b?.statistics).find((x) => x.name === n);
      const v = num(str(s?.displayValue)?.replace("%", "")) ?? num(s?.value);
      if (v != null) return v;
    }
    return null;
  };
  const both = (names: string[]) => pair(stat(homeBox, names), stat(awayBox, names));
  let possession = both(["possessionPct", "possession"]);
  if (possession && possession.home + possession.away <= 0) possession = null;

  const rosters = arr(d.rosters);
  const roster = (side: Side, team: SoccerTeam) =>
    rosters.find((r) => r.homeAway === side) ??
    rosters.find((r) => team.id != null && idOf(rec(r.team).id) === team.id);
  const homeRosterEntry = roster("home", home);
  const awayRosterEntry = roster("away", away);

  const status = rec(comp.status);
  const type = rec(status.type);
  const stateRaw = type.state;
  const state = stateRaw === "in" || stateRaw === "post" ? stateRaw : "pre";
  const detail = str(type.shortDetail) ?? str(type.detail) ?? "";
  const running = state === "in" && str(type.name) !== "STATUS_HALFTIME";

  return {
    home,
    away,
    state,
    clock: (running ? str(status.displayClock) : null) ?? detail,
    detail,
    possession,
    shots: both(["totalShots", "shotsTotal", "shots"]),
    shotsOnTarget: both(["shotsOnTarget", "shotsOnGoal"]),
    corners: both(["wonCorners", "corners", "cornerKicks"]),
    scorers,
    events,
    lastKey: events.find((e) => KEY_KINDS.has(e.kind)) ?? null,
    lastSpot: events.find((e) => e.spot != null) ?? null,
    momentum: homeP + awayP > 0 ? (homeP - awayP) / (homeP + awayP) : null,
    homeFormation: str(homeRosterEntry?.formation),
    awayFormation: str(awayRosterEntry?.formation),
    homeRoster: parseRoster(homeRosterEntry),
    awayRoster: parseRoster(awayRosterEntry),
  };
}
