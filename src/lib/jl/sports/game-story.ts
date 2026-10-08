import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { parsePregame, type InsightLeader } from "./insight.ts";
import { isFavoriteGame, type JlFavoriteTeam } from "./rank.ts";

/**
 * Game Stories: which games get a story, what ESPN's game summary says about them, and the
 * slides that tell it. Plain module, no I/O. Story text is written by `writeStory` from the
 * facts here only (templates); it is the single place a different writer could plug in later.
 */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export type Sport = "football" | "basketball" | "hockey" | "baseball" | "soccer";

const SPORT_BY_LEAGUE: Record<string, Sport> = {
  NFL: "football",
  NCAAF: "football",
  NBA: "basketball",
  NCAA: "basketball",
  NCAAB: "basketball",
  WNBA: "basketball",
  NHL: "hockey",
  MLB: "baseball",
};
const COLLEGE = new Set(["NCAAF", "NCAA", "NCAAB"]);
const US_PRO = new Set(["NFL", "NBA", "WNBA", "NHL", "MLB"]);

/** Team sport of a league tag; every other league in the hub is soccer. */
export function sportOf(league: string): Sport {
  return SPORT_BY_LEAGUE[league] ?? "soccer";
}

export const gameKey = (g: Pick<SportsGame, "league" | "id">): string => `${g.league}:${g.id}`;

/** How a team is named in a sentence: "Ohio State", "Eagles", "Arsenal". */
export function teamName(side: SportsSide, league: string): string {
  if (COLLEGE.has(league)) return side.location || side.name;
  if (US_PRO.has(league)) return side.nickname || side.name;
  return side.name;
}

/** Name with its poll rank when it has one: "No. 5 Ohio State". */
function rankedName(side: SportsSide, league: string): string {
  const name = teamName(side, league);
  return side.rank ? `No. ${side.rank} ${name}` : name;
}

/** Verb agreement: "the Eagles beat", "Ohio State beats". Only US pro nicknames read as plural. */
export function agree(side: SportsSide, league: string, singular: string, plural: string): string {
  if (!US_PRO.has(league)) return singular;
  const name = teamName(side, league);
  return /(?:[^s]s|Sox)$/.test(name) ? plural : singular;
}

const score = (side: SportsSide): number | null => num(side.score);

// ---------------------------------------------------------------------------
// Which games get a story

const STORY_WINDOW_MS = 30 * 3600000;
export const STORY_LIMIT = 12;

/**
 * Story bubbles: big games that are live or finished recently — your teams' games, games that
 * were in the Top 10 (`bigKeys`), and games with a ranked team. Your teams first, live before
 * finals, then the bigger matchup.
 */
export function storyGames(
  games: SportsGame[],
  opts: { favorites: JlFavoriteTeam[]; bigKeys: ReadonlySet<string>; now: Date; limit?: number },
): SportsGame[] {
  const { favorites, bigKeys, now, limit = STORY_LIMIT } = opts;
  const nowMs = now.getTime();
  const weight = (g: SportsGame) => {
    const ranks = [g.away.rank, g.home.rank].filter((r): r is number => !!r).length;
    return ranks * 2 + (bigKeys.has(gameKey(g)) ? 1 : 0);
  };
  const seen = new Set<string>();
  return games
    .filter((g) => {
      const key = gameKey(g);
      if (seen.has(key)) return false;
      seen.add(key);
      if (g.state === "pre") return false;
      if (g.state === "post" && !(g.startMs > 0 && nowMs - g.startMs <= STORY_WINDOW_MS))
        return false;
      return isFavoriteGame(g, favorites) || weight(g) > 0;
    })
    .map((g) => ({ g, mine: isFavoriteGame(g, favorites), w: weight(g) }))
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        (a.g.state === "in" ? 0 : 1) - (b.g.state === "in" ? 0 : 1) ||
        b.w - a.w ||
        (a.g.state === "post" ? b.g.startMs - a.g.startMs : a.g.startMs - b.g.startMs),
    )
    .slice(0, limit)
    .map((x) => x.g);
}

// ---------------------------------------------------------------------------
// ESPN game summary → story facts

export type StoryPlay = {
  id: string;
  side: "home" | "away" | null;
  /** "Q3", "P2", "2nd half", "7th". */
  period: string | null;
  clock: string | null;
  /** "Touchdown", "Field Goal", "Goal". */
  kind: string;
  text: string;
  away: number | null;
  home: number | null;
  athleteIds: string[];
};

export type StoryStatRow = { label: string; away: string; home: string };
export type StoryPeriodRow = { label: string; away: string; home: string };

export type StorySummary = {
  plays: StoryPlay[];
  leaders: { away: InsightLeader[]; home: InsightLeader[] };
  stats: StoryStatRow[];
  periods: StoryPeriodRow[];
  records: { away: string | null; home: string | null };
  /** Team colours as #rrggbb, for the story backdrop. */
  colors: { away: string | null; home: string | null };
  venue: string | null;
};

const ORDINAL = ["1st", "2nd", "3rd"];
const ordinal = (n: number) => ORDINAL[n - 1] ?? `${n}th`;

/** Period label in the sport's own words; past regulation is overtime (extra innings in baseball). */
export function periodLabel(sport: Sport, n: number): string {
  switch (sport) {
    case "football":
    case "basketball":
      return n <= 4 ? `Q${n}` : n === 5 ? "OT" : `${n - 4}OT`;
    case "hockey":
      return n <= 3 ? `P${n}` : n === 4 ? "OT" : "SO";
    case "baseball":
      return ordinal(n);
    case "soccer":
      return n === 1 ? "1st half" : n === 2 ? "2nd half" : "Extra time";
  }
}

const STAT_PREFERENCE: Record<Sport, string[]> = {
  football: [
    "totalYards",
    "netPassingYards",
    "rushingYards",
    "firstDowns",
    "thirdDownEff",
    "turnovers",
    "totalPenaltiesYards",
    "possessionTime",
  ],
  basketball: [
    "fieldGoalsMade-fieldGoalsAttempted",
    "fieldGoalPct",
    "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
    "totalRebounds",
    "assists",
    "turnovers",
    "steals",
    "blocks",
  ],
  hockey: [
    "shotsTotal",
    "powerPlayGoals",
    "faceoffsWon",
    "faceoffPercent",
    "hits",
    "blockedShots",
    "penaltyMinutes",
    "takeaways",
  ],
  baseball: ["hits", "runs", "errors", "homeRuns", "strikeouts", "walks"],
  soccer: [
    "possessionPct",
    "totalShots",
    "shotsOnTarget",
    "wonCorners",
    "foulsCommitted",
    "saves",
    "yellowCards",
    "redCards",
  ],
};
const MAX_STATS = 8;

type FlatStat = { name: string; label: string; value: string };

function flatStats(list: Rec[], out: FlatStat[] = []): FlatStat[] {
  for (const s of list) {
    if (Array.isArray(s.stats)) {
      flatStats(arr(s.stats), out);
      continue;
    }
    const name = str(s.name);
    const value = str(s.displayValue);
    if (!name || value == null) continue;
    out.push({ name, label: str(s.label) ?? str(s.displayName) ?? name, value });
  }
  return out;
}

function teamStats(
  summary: Rec,
  sport: Sport,
  ids: { away: string | null; home: string | null },
): StoryStatRow[] {
  const teams = arr(rec(summary.boxscore).teams);
  const find = (id: string | null, homeAway: "home" | "away") =>
    teams.find((t) => id && str(rec(t.team).id) === id) ??
    teams.find((t) => t.homeAway === homeAway);
  const away = flatStats(arr(find(ids.away, "away")?.statistics));
  const home = flatStats(arr(find(ids.home, "home")?.statistics));
  if (!away.length || !home.length) return [];
  const pair = (a: FlatStat): StoryStatRow | null => {
    const h = home.find((x) => x.name === a.name);
    return h ? { label: a.label, away: a.value, home: h.value } : null;
  };
  const preferred = STAT_PREFERENCE[sport]
    .map((name) => away.find((a) => a.name === name))
    .filter((a): a is FlatStat => !!a)
    .map(pair)
    .filter((r): r is StoryStatRow => !!r);
  if (preferred.length >= 3) return preferred.slice(0, MAX_STATS);
  return away
    .map(pair)
    .filter((r): r is StoryStatRow => !!r)
    .slice(0, MAX_STATS);
}

function parsePlay(
  p: Rec,
  sport: Sport,
  sideOf: (teamId: string | null) => "home" | "away" | null,
): StoryPlay | null {
  const kind = str(rec(p.scoringType).displayName) ?? str(rec(p.type).text) ?? "Score";
  const text = str(p.text) ?? str(p.shortText) ?? kind;
  const id = str(p.id) ?? (typeof p.id === "number" ? String(p.id) : null);
  if (!id) return null;
  const periodNo = num(rec(p.period).number) ?? num(p.period);
  const athleteIds = arr(p.participants)
    .map((x) => str(rec(x.athlete).id) ?? str(x.id))
    .filter((x): x is string => !!x);
  return {
    id,
    side: sideOf(str(rec(p.team).id)),
    period: periodNo ? periodLabel(sport, periodNo) : null,
    clock: str(rec(p.clock).displayValue),
    kind,
    text,
    away: num(p.awayScore),
    home: num(p.homeScore),
    athleteIds,
  };
}

function scoringPlays(
  summary: Rec,
  sport: Sport,
  sideOf: (teamId: string | null) => "home" | "away" | null,
): StoryPlay[] {
  const parse = (list: Rec[]) =>
    list.map((p) => parsePlay(p, sport, sideOf)).filter((p): p is StoryPlay => !!p);
  const listed = arr(summary.scoringPlays);
  if (listed.length) return parse(listed);
  if (sport === "soccer") {
    // Key events carry no running score: count the goals as they come.
    let away = 0;
    let home = 0;
    return parse(
      arr(summary.keyEvents).filter(
        (e) => e.scoringPlay === true || /\bgoal\b/i.test(str(rec(e.type).text) ?? ""),
      ),
    )
      .filter((p) => !/disallowed|missed|saved/i.test(p.kind))
      .map((p) => {
        if (p.side === "home") home++;
        else if (p.side === "away") away++;
        return { ...p, away, home };
      });
  }
  // Every basket is a scoring play: too many to tell a story with.
  if (sport === "basketball") return [];
  return parse(arr(summary.plays).filter((p) => p.scoringPlay === true));
}

const HEX = /^[0-9a-f]{6}$/i;

export function parseStorySummary(summary: unknown, league: string): StorySummary {
  const d = rec(summary);
  const sport = sportOf(league);
  const comp = arr(rec(d.header).competitions)[0] ?? {};
  const competitors = arr(comp.competitors);
  const homeC = competitors.find((c) => c.homeAway === "home") ?? competitors[0] ?? {};
  const awayC = competitors.find((c) => c.homeAway === "away") ?? competitors[1] ?? {};
  const ids = { away: str(rec(awayC.team).id), home: str(rec(homeC.team).id) };
  const sideOf = (teamId: string | null) =>
    teamId && teamId === ids.home ? "home" : teamId && teamId === ids.away ? "away" : null;

  const lines = (c: Rec) =>
    arr(c.linescores).map((l) => str(l.displayValue) ?? (num(l.value) ?? "").toString());
  const awayLines = lines(awayC);
  const homeLines = lines(homeC);
  const periods: StoryPeriodRow[] = [];
  for (let i = 0; i < Math.min(awayLines.length, homeLines.length); i++) {
    periods.push({
      label: periodLabel(sport, i + 1),
      away: awayLines[i] || "0",
      home: homeLines[i] || "0",
    });
  }

  const insight = parsePregame(d);
  const color = (c: Rec) => {
    const v = str(rec(c.team).color);
    return v && HEX.test(v) ? `#${v}` : null;
  };
  return {
    plays: scoringPlays(d, sport, sideOf),
    leaders: { away: insight.away?.leaders ?? [], home: insight.home?.leaders ?? [] },
    stats: teamStats(d, sport, ids),
    periods,
    records: { away: insight.away?.record ?? null, home: insight.home?.record ?? null },
    colors: { away: color(awayC), home: color(homeC) },
    venue: str(rec(rec(d.gameInfo).venue).fullName),
  };
}

// ---------------------------------------------------------------------------
// The story text

export type StoryFacts = { game: SportsGame; summary: StorySummary | null };
export type WrittenStory = { headline: string; paragraphs: string[] };

const CLOSE: Record<Sport, number> = {
  football: 3,
  basketball: 4,
  hockey: 1,
  baseball: 1,
  soccer: 1,
};
const ROUT: Record<Sport, number> = {
  football: 21,
  basketball: 20,
  hockey: 4,
  baseball: 7,
  soccer: 3,
};
const BIG_PERIOD: Record<Sport, number> = {
  football: 14,
  basketball: 12,
  hockey: 3,
  baseball: 5,
  soccer: 2,
};
const OVERTIME = /\b(OT|\d+OT|overtime|SO|shootout|AET|ET|pens?|penalties)\b|F\/\d{2}/i;

const dash = (a: number, b: number) => `${a}–${b}`;
const lower = (s: string) => s.toLowerCase();

/** Points scored by each side over the first `count` periods, when the line score has them. */
function through(periods: StoryPeriodRow[], count: number): { away: number; home: number } | null {
  if (periods.length < count) return null;
  let away = 0;
  let home = 0;
  for (const p of periods.slice(0, count)) {
    const a = num(p.away);
    const h = num(p.home);
    if (a == null || h == null) return null;
    away += a;
    home += h;
  }
  return { away, home };
}

const BREAK: Partial<Record<Sport, { periods: number; at: string }>> = {
  football: { periods: 2, at: "at halftime" },
  basketball: { periods: 2, at: "at halftime" },
  soccer: { periods: 1, at: "at the break" },
  hockey: { periods: 2, at: "after two periods" },
};

function leaderLine(l: InsightLeader | undefined, team: string, verb: string): string | null {
  if (!l) return null;
  return `${l.athlete} ${verb} ${team} in ${lower(l.category)} (${l.value}).`;
}

function finalStory(game: SportsGame, summary: StorySummary | null, sport: Sport): WrittenStory {
  const { league } = game;
  const a = score(game.away);
  const h = score(game.home);
  if (a == null || h == null) {
    return {
      headline: `Final: ${teamName(game.away, league)} at ${teamName(game.home, league)}`,
      paragraphs: [],
    };
  }
  const paragraphs: string[] = [];
  const venue = summary?.venue ? ` at ${summary.venue}` : "";
  if (a === h) {
    const A = rankedName(game.away, league);
    const B = rankedName(game.home, league);
    const word = sport === "soccer" ? "draw" : "tie";
    paragraphs.push(`${A} and ${B} finished level at ${dash(a, h)}${venue}.`);
    const lines = [
      leaderLine(summary?.leaders.away[0], teamName(game.away, league), "led"),
      leaderLine(summary?.leaders.home[0], teamName(game.home, league), "led"),
    ].filter((x): x is string => !!x);
    if (lines.length) paragraphs.push(lines.join(" "));
    return { headline: `${A} and ${B} ${word} ${dash(a, h)}`, paragraphs };
  }

  const homeWon = h > a;
  const W = homeWon ? game.home : game.away;
  const L = homeWon ? game.away : game.home;
  const ws = Math.max(a, h);
  const ls = Math.min(a, h);
  const margin = ws - ls;
  const wName = rankedName(W, league);
  const lName = rankedName(L, league);
  const final = dash(ws, ls);
  const v = (sing: string, plur: string) => agree(W, league, sing, plur);

  const upset = !!L.rank && (!W.rank || W.rank > L.rank);
  const overtime = OVERTIME.test(game.detail);
  let headline: string;
  if (upset) headline = `${wName} ${v("stuns", "stun")} ${lName}, ${final}`;
  else if (overtime)
    headline = `${wName} ${v("outlasts", "outlast")} ${lName} in ${sport === "baseball" ? "extras" : "overtime"}, ${final}`;
  else if (ls === 0 && sport !== "basketball")
    headline = `${wName} ${v("blanks", "blank")} ${lName}, ${final}`;
  else if (margin >= ROUT[sport]) headline = `${wName} ${v("routs", "rout")} ${lName}, ${final}`;
  else if (margin <= CLOSE[sport]) headline = `${wName} ${v("edges", "edge")} ${lName}, ${final}`;
  else headline = `${wName} ${v("beats", "beat")} ${lName}, ${final}`;

  const wShort = teamName(W, league);
  const lShort = teamName(L, league);
  const opening = upset
    ? `${wName} took down ${lName} ${final}${venue}.`
    : margin <= CLOSE[sport]
      ? `${wShort} held off ${lName} ${final}${venue}.`
      : `${wShort} beat ${lName} ${final}${venue}.`;
  const flow: string[] = [opening];

  const periods = summary?.periods ?? [];
  const brk = BREAK[sport];
  const mid = brk ? through(periods, brk.periods) : null;
  if (brk && mid) {
    const wMid = homeWon ? mid.home : mid.away;
    const lMid = homeWon ? mid.away : mid.home;
    if (wMid < lMid) flow.push(`${wShort} trailed ${dash(lMid, wMid)} ${brk.at} and came back.`);
    else if (wMid === lMid) flow.push(`It was ${dash(wMid, lMid)} ${brk.at}.`);
    else if (wMid - lMid >= ROUT[sport] / 2)
      flow.push(`${wShort} led ${dash(wMid, lMid)} ${brk.at} and never looked back.`);
  }
  // A period that decided it: the winner's biggest edge in any one period.
  let best: { label: string; edge: number; pts: number } | null = null;
  for (const p of periods) {
    const wp = num(homeWon ? p.home : p.away);
    const lp = num(homeWon ? p.away : p.home);
    if (wp == null || lp == null) continue;
    if (!best || wp - lp > best.edge) best = { label: p.label, edge: wp - lp, pts: wp };
  }
  if (best && best.edge >= BIG_PERIOD[sport] && sport !== "soccer") {
    flow.push(
      `A ${best.pts}–${best.pts - best.edge} edge in the ${periodWords(best.label)} made the difference.`,
    );
  }
  const plays = summary?.plays ?? [];
  const decider = plays.length && margin <= CLOSE[sport] ? plays[plays.length - 1] : null;
  if (decider && decider.side === (homeWon ? "home" : "away"))
    flow.push(`The deciding score: ${decider.text}.`);
  paragraphs.push(flow.join(" "));

  const wLeaders = homeWon ? summary?.leaders.home : summary?.leaders.away;
  const lLeaders = homeWon ? summary?.leaders.away : summary?.leaders.home;
  const people = [
    leaderLine(wLeaders?.[0], wShort, "led"),
    leaderLine(lLeaders?.[0], lShort, "paced"),
  ].filter((x): x is string => !!x);
  const wRec = homeWon ? summary?.records.home : summary?.records.away;
  const lRec = homeWon ? summary?.records.away : summary?.records.home;
  if (wRec && lRec) people.push(`Records: ${wShort} ${wRec}, ${lShort} ${lRec}.`);
  if (people.length) paragraphs.push(people.join(" "));
  return { headline, paragraphs };
}

function periodWords(label: string): string {
  const q = /^Q(\d)$/.exec(label);
  if (q) return `${ordinal(Number(q[1]))} quarter`;
  const p = /^P(\d)$/.exec(label);
  if (p) return `${ordinal(Number(p[1]))} period`;
  if (/^\d+(st|nd|rd|th)$/.test(label)) return `${label} inning`;
  if (label === "OT") return "overtime";
  return label;
}

function liveStory(game: SportsGame, summary: StorySummary | null): WrittenStory {
  const { league } = game;
  const a = score(game.away) ?? 0;
  const h = score(game.home) ?? 0;
  const A = rankedName(game.away, league);
  const B = rankedName(game.home, league);
  let headline: string;
  if (a === h)
    headline = a === 0 ? `${A} and ${B}, scoreless so far` : `${A} and ${B} tied at ${a}`;
  else {
    const lead = h > a ? game.home : game.away;
    const trail = h > a ? game.away : game.home;
    headline = `${rankedName(lead, league)} ${agree(lead, league, "leads", "lead")} ${rankedName(trail, league)} ${dash(Math.max(a, h), Math.min(a, h))}`;
  }
  const paragraphs: string[] = [];
  const now = [game.detail ? `Live, ${game.detail}.` : "Live now."];
  const last = summary?.plays[summary.plays.length - 1];
  if (last) {
    const at = last.away != null && last.home != null ? ` (${dash(last.away, last.home)})` : "";
    now.push(`Latest score: ${last.text}${at}.`);
  }
  paragraphs.push(now.join(" "));
  const people = [
    leaderLine(summary?.leaders.away[0], teamName(game.away, league), "leads"),
    leaderLine(summary?.leaders.home[0], teamName(game.home, league), "leads"),
  ].filter((x): x is string => !!x);
  if (people.length) paragraphs.push(people.join(" "));
  return { headline, paragraphs };
}

function previewStory(game: SportsGame, summary: StorySummary | null): WrittenStory {
  const { league } = game;
  const A = rankedName(game.away, league);
  const B = rankedName(game.home, league);
  const paragraphs: string[] = [];
  const when = [game.detail, game.network ? `on ${game.network}` : null].filter(Boolean).join(" ");
  if (when) paragraphs.push(`${when}.`);
  const recs = summary?.records;
  if (recs?.away && recs.home)
    paragraphs.push(
      `${teamName(game.away, league)} (${recs.away}) visit ${teamName(game.home, league)} (${recs.home}).`,
    );
  return { headline: `${A} at ${B}`, paragraphs };
}

/**
 * Writes the story's headline and paragraphs from the facts given, and nothing else. Templates
 * today: this is the one function an AI writer would replace, with the same input and output.
 */
export function writeStory(facts: StoryFacts): WrittenStory {
  const { game, summary } = facts;
  if (game.state === "post") return finalStory(game, summary, sportOf(game.league));
  if (game.state === "in") return liveStory(game, summary);
  return previewStory(game, summary);
}

// ---------------------------------------------------------------------------
// Slides

export type StorySlide =
  | { kind: "story"; key: string; label: string; headline: string; paragraphs: string[] }
  | { kind: "plays"; key: string; label: string; plays: StoryPlay[] }
  | {
      kind: "leaders";
      key: string;
      label: string;
      leaders: Array<InsightLeader & { side: "home" | "away" }>;
    }
  | { kind: "periods"; key: string; label: string; rows: StoryPeriodRow[] }
  | { kind: "stats"; key: string; label: string; rows: StoryStatRow[] };

const MAX_PLAYS = 8;

/** The story's slides, in order: the story, scoring, top performers, score by period, team stats. */
export function storySlides(
  game: SportsGame,
  summary: StorySummary | null,
  write: (facts: StoryFacts) => WrittenStory = writeStory,
): StorySlide[] {
  const story = write({ game, summary });
  const live = game.state === "in";
  const slides: StorySlide[] = [
    {
      kind: "story",
      key: "story",
      label: game.state === "post" ? "Recap" : live ? "Live" : "Preview",
      headline: story.headline,
      paragraphs: story.paragraphs,
    },
  ];
  if (!summary) return slides;
  if (summary.plays.length) {
    slides.push({
      kind: "plays",
      key: "plays",
      label: live ? "Scoring so far" : "Scoring summary",
      plays: summary.plays.slice(-MAX_PLAYS),
    });
  }
  const leaders = [
    ...summary.leaders.away.map((l) => ({ ...l, side: "away" as const })),
    ...summary.leaders.home.map((l) => ({ ...l, side: "home" as const })),
  ];
  if (leaders.length)
    slides.push({ kind: "leaders", key: "leaders", label: "Top performers", leaders });
  if (summary.periods.length >= 2) {
    slides.push({
      kind: "periods",
      key: "periods",
      label: "Score by period",
      rows: summary.periods,
    });
  }
  if (summary.stats.length)
    slides.push({ kind: "stats", key: "stats", label: "Team stats", rows: summary.stats });
  return slides;
}
