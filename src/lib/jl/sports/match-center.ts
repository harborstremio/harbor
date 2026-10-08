import {
  cleanName,
  matchPath,
  num,
  tables,
  toGame,
  toGames,
  tournamentPath,
  type AsGame,
  type AsGet,
  type Table,
} from "./as-core.ts";

/**
 * Match Center from AllSports: score by period, momentum, the events timeline, team stats,
 * lineups with each player's line, best players, head-to-head and the league table.
 * Parsers are plain functions; loadMatchCenter takes the getter so it runs with any client.
 */

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type Side = "home" | "away";

// ---- Score by period ---------------------------------------------------------------------------

export type PeriodRow = { label: string; away: number | null; home: number | null };

/** Score by quarter / period / inning / half / set: labels from event.periods, scores from periodN. */
export function periodRows(e: unknown): PeriodRow[] {
  const ev = rec(e);
  const labels = rec(ev.periods);
  const home = rec(ev.homeScore);
  const away = rec(ev.awayScore);
  const order = (k: string) => (k === "overtime" ? 99 : Number(k.slice(6)));
  const keys = Object.keys({ ...home, ...away })
    .filter((k) => /^period\d+$|^overtime$/.test(k))
    .sort((a, b) => order(a) - order(b));
  const short = (k: string) => {
    const l = String(labels[k] ?? "");
    const n = /^(\d+)/.exec(l)?.[1] ?? k.replace("period", "");
    if (k === "overtime") return "OT";
    if (/quarter/i.test(l)) return `Q${n}`;
    if (/period/i.test(l)) return `P${n}`;
    if (/inning/i.test(l)) return n;
    if (/half/i.test(l)) return `H${n}`;
    if (/set/i.test(l)) return `S${n}`;
    if (/map/i.test(l)) return `M${n}`;
    return n;
  };
  return keys.map((k) => ({ label: short(k), away: num(away[k]), home: num(home[k]) }));
}

// ---- Momentum ----------------------------------------------------------------------------------

export type MarginPoint = { minute: number; margin: number };

/**
 * /graph points as home-positive values. For score-margin sports the feed's sign is checked
 * against the final score; soccer's graph is attack pressure (already home-positive).
 */
export function marginPoints(
  points: unknown,
  homeFinal: number | null,
  awayFinal: number | null,
): MarginPoint[] {
  const pts = list(points)
    .map((p) => ({ minute: Number(rec(p).minute), margin: Number(rec(p).value) }))
    .filter((p) => Number.isFinite(p.minute) && Number.isFinite(p.margin));
  if (!pts.length) return [];
  const last = pts[pts.length - 1].margin;
  const flip =
    homeFinal != null && awayFinal != null && last !== 0 && last === awayFinal - homeFinal;
  return flip ? pts.map((p) => ({ ...p, margin: -p.margin })) : pts;
}

// ---- Events timeline ---------------------------------------------------------------------------

export type TimelineKind = "score" | "yellow" | "red" | "sub" | "period" | "var" | "miss";
export type TimelineItem = {
  id: string;
  side: Side | null;
  clock: string | null;
  kind: TimelineKind;
  title: string;
  player: string | null;
  detail: string | null;
  score: { home: number; away: number } | null;
};

const SCORE_KIND: Record<string, string> = {
  touchdown: "Touchdown",
  extraPoint: "Extra point",
  fieldGoal: "Field goal",
  twoPoints: "2-pt conversion",
  safety: "Safety",
  regular: "Goal",
  penalty: "Penalty goal",
  ownGoal: "Own goal",
};

const PERIOD_LENGTH: Record<string, number> = { basketball: 720, "ice-hockey": 1200 };

/** /incidents → the game's events, oldest first. Soccer: goals, cards, substitutions, VAR, breaks. */
export function timeline(incidents: unknown, slug: string): TimelineItem[] {
  const soccer = slug === "football";
  const periodLength = PERIOD_LENGTH[slug] ?? 900;
  const out: TimelineItem[] = [];
  list(incidents).forEach((raw, i) => {
    const x = rec(raw);
    const type = String(x.incidentType ?? "");
    const cls = String(x.incidentClass ?? "");
    const side: Side | null = x.isHome === true ? "home" : x.isHome === false ? "away" : null;
    const minute = num(x.time);
    let clock: string | null = null;
    if (soccer || slug === "rugby" || slug === "handball") {
      const added = num(x.addedTime);
      clock = minute != null ? `${minute}${added ? `+${added}` : ""}'` : null;
    } else if (slug !== "baseball") {
      const secs = num(x.timeSeconds);
      const left = num(x.reversedPeriodTimeSeconds);
      const period = secs != null && secs > 0 ? Math.floor((secs - 1) / periodLength) + 1 : null;
      const label = period ? (slug === "ice-hockey" ? `P${period}` : `Q${period}`) : null;
      const time =
        left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : null;
      clock = [label, time].filter(Boolean).join(" ") || null;
    }
    const name = (p: unknown) => (rec(p).name ? cleanName(rec(p).name) : null);
    const player = name(x.player) ?? (x.playerName ? cleanName(x.playerName) : null);
    const id = String(x.id ?? `${type}-${i}`);
    const score =
      num(x.homeScore) != null && num(x.awayScore) != null
        ? { home: Number(x.homeScore), away: Number(x.awayScore) }
        : null;
    if (type === "goal") {
      const assist = name(x.assist1);
      out.push({
        id,
        side,
        clock,
        kind: "score",
        title:
          SCORE_KIND[cls] ??
          (soccer ? "Goal" : cls ? cls.replace(/([a-z])([A-Z])/g, "$1 $2") : "Score"),
        player,
        detail: assist ? `Assist: ${assist}` : null,
        score,
      });
    } else if (type === "card") {
      const red = cls === "red" || cls === "yellowRed";
      out.push({
        id,
        side,
        clock,
        kind: red ? "red" : "yellow",
        title: cls === "yellowRed" ? "Second yellow" : red ? "Red card" : "Yellow card",
        player,
        detail: x.reason ? cleanName(x.reason) : null,
        score: null,
      });
    } else if (type === "substitution") {
      const out_ = name(x.playerOut);
      out.push({
        id,
        side,
        clock,
        kind: "sub",
        title: x.injury ? "Substitution (injury)" : "Substitution",
        player: name(x.playerIn),
        detail: out_ ? `Off: ${out_}` : null,
        score: null,
      });
    } else if (type === "varDecision") {
      out.push({
        id,
        side,
        clock,
        kind: "var",
        title: `VAR: ${cls.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() || "review"}${x.confirmed === false ? " (overturned)" : ""}`,
        player,
        detail: null,
        score: null,
      });
    } else if (type === "inGamePenalty" && cls === "missed") {
      out.push({
        id,
        side,
        clock,
        kind: "miss",
        title: "Penalty missed",
        player,
        detail: null,
        score: null,
      });
    } else if (type === "period" && x.text) {
      out.push({
        id,
        side: null,
        clock: null,
        kind: "period",
        title: String(x.text),
        player: null,
        detail: null,
        score,
      });
    }
  });
  // The feed lists newest first.
  return out.reverse();
}

// ---- Team stats --------------------------------------------------------------------------------

export type StatGroup = { name: string; rows: { label: string; away: string; home: string }[] };

/** /statistics → the whole-game groups ("ALL"), falling back to the first period listed. */
export function statGroups(d: unknown): StatGroup[] {
  const periods = list(rec(d).statistics);
  const all = periods.find((p) => rec(p).period === "ALL") ?? periods[0];
  return list(rec(all).groups)
    .map((g) => ({
      name: cleanName(rec(g).groupName),
      rows: list(rec(g).statisticsItems)
        .map((i) => ({
          label: cleanName(rec(i).name),
          away: String(rec(i).away ?? ""),
          home: String(rec(i).home ?? ""),
        }))
        .filter((r) => r.label),
    }))
    .filter((g) => g.rows.length);
}

// ---- Lineups -----------------------------------------------------------------------------------

export type LineupPlayer = {
  id: number;
  name: string;
  position: string | null;
  jersey: string | null;
  starter: boolean;
  line: string | null;
};
export type Lineup = { formation: string | null; players: LineupPlayer[] };

/** One player's line for the game ("2 rec, 22 yds", "24 pts, 8 reb, 5 ast", "1 G · 7.8"). */
export function gameLine(slug: string, stats: unknown): string | null {
  const s = rec(stats);
  const n = (k: string) => num(s[k]);
  const has = (k: string) => (n(k) ?? 0) > 0;
  const parts: string[] = [];
  if (slug === "american-football") {
    if (has("passingAttempts"))
      parts.push(
        `${n("passingCompletions") ?? 0}/${n("passingAttempts")}, ${n("passingYards") ?? 0} yds${has("passingTouchdowns") ? `, ${n("passingTouchdowns")} TD` : ""}${has("passingInterceptions") ? `, ${n("passingInterceptions")} INT` : ""}`,
      );
    if (has("rushingAttempts"))
      parts.push(
        `${n("rushingAttempts")} car, ${n("rushingYards") ?? 0} yds${has("rushingTouchdowns") ? `, ${n("rushingTouchdowns")} TD` : ""}`,
      );
    if (has("receivingReceptions") || has("receivingTargets"))
      parts.push(
        `${n("receivingReceptions") ?? 0} rec, ${n("receivingYards") ?? 0} yds${has("receivingTouchdowns") ? `, ${n("receivingTouchdowns")} TD` : ""}`,
      );
    if (has("defensiveCombineTackles") || has("defensiveSacks"))
      parts.push(
        `${n("defensiveCombineTackles") ?? 0} tkl${has("defensiveSacks") ? `, ${n("defensiveSacks")} sack${n("defensiveSacks") === 1 ? "" : "s"}` : ""}`,
      );
  } else if (slug === "basketball") {
    if (n("points") != null)
      parts.push(`${n("points")} pts, ${n("rebounds") ?? 0} reb, ${n("assists") ?? 0} ast`);
  } else if (slug === "ice-hockey") {
    if (has("saves")) parts.push(`${n("saves")} saves`);
    else if (n("goals") != null || n("assists") != null)
      parts.push(`${n("goals") ?? 0} G, ${n("assists") ?? 0} A`);
  } else if (slug === "baseball") {
    if (has("battingAtBats"))
      parts.push(
        `${n("battingHits") ?? 0}-for-${n("battingAtBats")}${has("battingHomeRuns") ? `, ${n("battingHomeRuns")} HR` : ""}${has("battingRbi") ? `, ${n("battingRbi")} RBI` : ""}`,
      );
    if (has("pitchingInningsPitched"))
      parts.push(
        `${n("pitchingInningsPitched")} IP, ${n("pitchingEarnedRuns") ?? 0} ER, ${n("pitchingStrikeOuts") ?? 0} K`,
      );
  } else if (slug === "football") {
    if (has("goals")) parts.push(`${n("goals")} G`);
    if (has("goalAssist")) parts.push(`${n("goalAssist")} A`);
    if (has("saves")) parts.push(`${n("saves")} saves`);
    if (n("rating") != null) parts.push(Number(n("rating")).toFixed(1));
  }
  return parts.length ? parts.join(" · ") : null;
}

/** One side of /lineups; for US sports players with a line come first, soccer keeps the feed order. */
export function lineupSide(side: unknown, slug: string): Lineup {
  const s = rec(side);
  const players = list(s.players)
    .map((raw): LineupPlayer => {
      const p = rec(raw);
      const player = rec(p.player);
      const jersey = p.jerseyNumber ?? p.shirtNumber ?? player.jerseyNumber ?? null;
      return {
        id: Number(player.id),
        name: cleanName(player.name),
        position: (p.position ?? player.position ?? null) as string | null,
        jersey: jersey != null ? String(jersey) : null,
        starter: !p.substitute,
        line: p.statistics ? gameLine(slug, p.statistics) : null,
      };
    })
    .filter((p) => p.name);
  if (slug !== "football")
    players.sort(
      (a, b) => Number(!!b.line) - Number(!!a.line) || Number(b.starter) - Number(a.starter),
    );
  else players.sort((a, b) => Number(b.starter) - Number(a.starter));
  return { formation: typeof s.formation === "string" ? s.formation : null, players };
}

// ---- Before the game ---------------------------------------------------------------------------

export type Form = { form: string[]; place: number | null };
export function formOf(x: unknown): Form | null {
  const f = rec(x);
  if (!x || !Array.isArray(f.form)) return null;
  return { form: f.form.map(String).slice(-5), place: num(f.position) };
}

export type BestPlayer = {
  side: Side;
  id: number;
  name: string;
  position: string | null;
  value: string;
};
export function bestPlayers(d: unknown): BestPlayer[] {
  const b = rec(d);
  const one = (x: unknown, side: Side): BestPlayer | null => {
    const p = rec(rec(x).player);
    if (!p.name) return null;
    return {
      side,
      id: Number(p.id),
      name: cleanName(p.name),
      position: (p.position as string) ?? null,
      value: `${rec(x).value ?? ""} ${rec(x).label ?? ""}`.trim(),
    };
  };
  return [one(b.bestAwayTeamPlayer, "away"), one(b.bestHomeTeamPlayer, "home")].filter(
    (x): x is BestPlayer => !!x,
  );
}

/** Previous meetings (finished, newest first, without this game). */
export function meetings(d: unknown, slug: string, exclude: number, limit = 6): AsGame[] {
  return toGames(d, slug)
    .filter((g) => g.state === "post" && g.id !== exclude)
    .sort((a, b) => b.startMs - a.startMs)
    .slice(0, limit);
}

// ---- Loader ------------------------------------------------------------------------------------

export type MatchCenter = {
  event: AsGame;
  tournament: string;
  venue: string | null;
  attendance: number | null;
  referee: string | null;
  periods: PeriodRow[];
  margin: MarginPoint[];
  timeline: TimelineItem[];
  stats: StatGroup[];
  lineups: { confirmed: boolean; away: Lineup; home: Lineup } | null;
  best: BestPlayer[];
  form: { away: Form | null; home: Form | null };
  coaches: { away: string | null; home: string | null };
  series: { away: number; home: number; draws: number } | null;
  meetings: AsGame[];
  standings: Table[];
};

const MIN = 60_000;
const HOUR = 3_600_000;

/** Every part of the Match Center. Null when AllSports doesn't know the game. */
export async function loadMatchCenter(
  get: AsGet,
  slug: string,
  id: number,
): Promise<MatchCenter | null> {
  const base = matchPath(slug, id);
  const d = await get<{ event?: unknown }>(base, 20_000);
  const raw = rec(d?.event);
  const event = d?.event ? toGame(d.event, slug) : null;
  if (!event) return null;
  const inPlay = event.state === "in";
  const ttl = inPlay ? 20_000 : event.state === "pre" ? 5 * MIN : HOUR;
  const soft = <T>(p: Promise<T | null>) => p.catch(() => null);
  const started = event.state !== "pre";
  const [incidents, stats, lineups, graph, best, form, managers, duel, h2h, standings] =
    await Promise.all([
      started ? soft(get(`${base}/incidents`, ttl)) : null,
      started ? soft(get(`${base}/statistics`, ttl)) : null,
      soft(get(`${base}/lineups`, inPlay ? 2 * MIN : ttl)),
      started ? soft(get<{ graphPoints?: unknown }>(`${base}/graph`, ttl)) : null,
      started ? soft(get(`${base}/best-players`, ttl)) : null,
      soft(get<{ homeTeam?: unknown; awayTeam?: unknown }>(`${base}/form`, HOUR)),
      soft(
        get<{ homeManager?: { name?: string }; awayManager?: { name?: string } }>(
          `${base}/managers`,
          6 * HOUR,
        ),
      ),
      soft(
        get<{ teamDuel?: { homeWins?: number; awayWins?: number; draws?: number } }>(
          `${base}/duel`,
          6 * HOUR,
        ),
      ),
      event.customId ? soft(get(`${matchPath(slug, event.customId)}/h2h`, 6 * HOUR)) : null,
      event.tournamentId && event.seasonId
        ? soft(
            get(
              `${tournamentPath(slug, event.tournamentId)}/season/${event.seasonId}/standings/total`,
              inPlay ? 5 * MIN : HOUR,
            ),
          )
        : null,
    ]);
  const l = rec(lineups);
  const venue = rec(raw.venue);
  const city = rec(venue.city);
  const referee = rec(raw.referee);
  const homeFinal = num(rec(raw.homeScore).current);
  const awayFinal = num(rec(raw.awayScore).current);
  const duelRec = duel?.teamDuel;
  return {
    event,
    tournament: event.league,
    venue: venue.name
      ? [cleanName(venue.name), city.name ? cleanName(city.name) : null].filter(Boolean).join(", ")
      : null,
    attendance: num(raw.attendance),
    referee: referee.name ? cleanName(referee.name) : null,
    periods: started ? periodRows(raw) : [],
    margin: marginPoints(graph?.graphPoints, homeFinal, awayFinal),
    timeline: timeline(rec(incidents).incidents, slug),
    stats: statGroups(stats),
    lineups: lineups
      ? { confirmed: !!l.confirmed, away: lineupSide(l.away, slug), home: lineupSide(l.home, slug) }
      : null,
    best: bestPlayers(best),
    form: { away: formOf(form?.awayTeam), home: formOf(form?.homeTeam) },
    coaches: {
      away: managers?.awayManager?.name ? cleanName(managers.awayManager.name) : null,
      home: managers?.homeManager?.name ? cleanName(managers.homeManager.name) : null,
    },
    series: duelRec
      ? {
          away: Number(duelRec.awayWins ?? 0),
          home: Number(duelRec.homeWins ?? 0),
          draws: Number(duelRec.draws ?? 0),
        }
      : null,
    meetings: meetings(h2h, slug, id),
    standings: tables(standings),
  };
}

/** Momentum chart wording per sport: score margin, or soccer's attack pressure. */
export function momentumKind(slug: string): {
  mode: "margin" | "pressure";
  periods: number;
  prefix: string;
} {
  if (slug === "football") return { mode: "pressure", periods: 2, prefix: "H" };
  if (slug === "ice-hockey") return { mode: "margin", periods: 3, prefix: "P" };
  if (slug === "basketball" || slug === "american-football")
    return { mode: "margin", periods: 4, prefix: "Q" };
  return { mode: "margin", periods: 0, prefix: "" };
}
