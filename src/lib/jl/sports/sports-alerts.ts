import type { SportsGame } from "../../sports/espn.ts";
import { agree, gameKey, sportOf, teamName, writeStory, type StoryPlay } from "./game-story.ts";

/**
 * Sports alerts (plain module, tested): compares two snapshots of the scoreboards the app already
 * polls and says what's new. Your teams (and followed athletes' teams): kick-off, every score, the
 * final. Followed athletes: their scoring plays. Top 10 games: kick-off, lead changes, the final.
 * Nothing fires for what was already true on the first snapshot, so opening the app doesn't
 * replay the day.
 */

export type AlertPlay = {
  id: string;
  side: "home" | "away" | null;
  kind: string;
  text: string;
  /** The followed athlete in this play, for athlete alerts. */
  player: string | null;
  away: number | null;
  home: number | null;
};

export type AlertSide = { name: string; score: number | null; singular: boolean };

export type AlertGame = {
  key: string;
  /** Failed refreshes must never trigger a new live or score notification. */
  savedAt?: number;
  league: string;
  state: SportsGame["state"];
  away: AlertSide;
  home: AlertSide;
  /** A followed team plays (or a followed athlete's team). */
  mine: boolean;
  /** In the Top 10, now or earlier this session. */
  top: boolean;
  /** The final's one-line story, once the game is over. */
  finalLine: string | null;
  /** Latest scoring play; undefined when the game's summary wasn't read this time. */
  lastPlay?: AlertPlay | null;
  /** Scoring plays by followed athletes; undefined when not read this time. */
  athletePlays?: AlertPlay[];
};

export type SportsAlertKind = "kickoff" | "score" | "lead" | "athlete" | "final";

export type SportsAlert = {
  id: string;
  kind: SportsAlertKind;
  title: string;
  text: string;
  gameKey: string;
  /** About your team or athlete (still shown while the full-screen player is up). */
  mine: boolean;
};

export type FollowedAthlete = { league: string; id: string; name: string; teamId: string | null };

const toNum = (s: string): number | null => {
  const n = s.trim() ? Number(s) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Initial-and-surname spellings ESPN uses in play text: "S.Barkley", "S. Barkley". */
function mentions(text: string, name: string): boolean {
  const parts = name.trim().split(/\s+/);
  if (text.includes(name)) return true;
  if (parts.length < 2) return false;
  const last = parts.slice(1).join(" ");
  const initial = parts[0][0];
  return text.includes(`${initial}.${last}`) || text.includes(`${initial}. ${last}`);
}

/** Scoring plays in this game by athletes you follow on its teams, by ESPN id or by name in the play. */
export function athletePlaysIn(
  game: SportsGame,
  plays: StoryPlay[],
  athletes: FollowedAthlete[],
): AlertPlay[] {
  const here = athletes.filter(
    (p) =>
      p.league === game.league &&
      (!p.teamId || p.teamId === game.home.id || p.teamId === game.away.id),
  );
  if (!here.length) return [];
  const out: AlertPlay[] = [];
  for (const play of plays) {
    const who = here.find((p) => play.athleteIds.includes(p.id) || mentions(play.text, p.name));
    if (who) out.push(toAlertPlay(play, who.name));
  }
  return out;
}

function toAlertPlay(p: StoryPlay, player: string | null = null): AlertPlay {
  return { id: p.id, side: p.side, kind: p.kind, text: p.text, player, away: p.away, home: p.home };
}

/**
 * One game as the alert diff sees it. Pass `plays` (from the game's summary) when they were read
 * this time, and leave it out otherwise: a missing summary never looks like "no plays".
 */
export function toAlertGame(
  game: SportsGame,
  opts: { mine: boolean; top: boolean; plays?: StoryPlay[] | null; athletes?: FollowedAthlete[] },
): AlertGame {
  const side = (s: SportsGame["home"]): AlertSide => ({
    name: teamName(s, game.league),
    score: toNum(s.score),
    singular: agree(s, game.league, "s", "") === "s",
  });
  const out: AlertGame = {
    key: gameKey(game),
    ...(game.savedAt !== undefined ? { savedAt: game.savedAt } : {}),
    league: game.league,
    state: game.state,
    away: side(game.away),
    home: side(game.home),
    mine: opts.mine,
    top: opts.top,
    finalLine: game.state === "post" ? writeStory({ game, summary: null }).headline : null,
  };
  if (opts.plays) {
    const last = opts.plays[opts.plays.length - 1];
    out.lastPlay = last ? toAlertPlay(last) : null;
    out.athletePlays = athletePlaysIn(game, opts.plays, opts.athletes ?? []);
  }
  return out;
}

const title = (g: AlertGame) => `${g.away.name} at ${g.home.name}`;
const line = (g: AlertGame, away: number | null, home: number | null) =>
  `${g.away.name} ${away ?? 0}–${home ?? 0} ${g.home.name}`;
const verb = (s: AlertSide, singular: string, plural: string) => (s.singular ? singular : plural);

/** What a jump in score most likely was, when no play-by-play is at hand. */
export function scoreKind(league: string, points: number): string {
  switch (sportOf(league)) {
    case "football":
      return points >= 6
        ? "Touchdown"
        : points === 3
          ? "Field goal"
          : points === 2
            ? "Safety"
            : "Score";
    case "hockey":
    case "soccer":
      return points > 1 ? `${points} goals` : "Goal";
    case "baseball":
      return points > 1 ? `${points} runs score` : "Run scores";
    case "basketball":
      return "Score";
  }
}

const leader = (g: AlertGame): -1 | 0 | 1 | null =>
  g.away.score == null || g.home.score == null
    ? null
    : (Math.sign(g.home.score - g.away.score) as -1 | 0 | 1);

function leadAlert(p: AlertGame, g: AlertGame): SportsAlert | null {
  const before = leader(p);
  const after = leader(g);
  if (before == null || after == null || before === after) return null;
  const key = `${g.key}:lead:${g.away.score}-${g.home.score}`;
  if (after === 0) {
    // Basketball ties come and go every few possessions.
    if (sportOf(g.league) === "basketball") return null;
    return {
      id: key,
      kind: "lead",
      title: `Tied up: ${line(g, g.away.score, g.home.score)}`,
      text: title(g),
      gameKey: g.key,
      mine: g.mine,
    };
  }
  const ahead = after > 0 ? g.home : g.away;
  return {
    id: key,
    kind: "lead",
    title: `${ahead.name} ${verb(ahead, "takes", "take")} the lead`,
    text: line(g, g.away.score, g.home.score),
    gameKey: g.key,
    mine: g.mine,
  };
}

function scoreAlerts(p: AlertGame, g: AlertGame): SportsAlert[] {
  const basketball = sportOf(g.league) === "basketball";
  if (!g.mine || basketball) {
    // Top 10 games, and basketball (a score every possession): only when the lead changes.
    const lead = leadAlert(p, g);
    return lead ? [lead] : [];
  }
  // Your team's game: every scoring play, by play when the summary was read both times.
  if (g.lastPlay && p.lastPlay !== undefined && g.lastPlay.id !== p.lastPlay?.id) {
    const play = g.lastPlay;
    const who = play.side ? g[play.side].name : null;
    return [
      {
        id: `${g.key}:play:${play.id}`,
        kind: "score",
        title: who ? `${who}: ${play.kind}` : play.kind,
        text: `${play.text} · ${line(g, play.away, play.home)}`,
        gameKey: g.key,
        mine: true,
      },
    ];
  }
  if (g.lastPlay !== undefined && p.lastPlay !== undefined) return [];
  const da = (g.away.score ?? 0) - (p.away.score ?? 0);
  const dh = (g.home.score ?? 0) - (p.home.score ?? 0);
  if (g.away.score == null || g.home.score == null || (da <= 0 && dh <= 0)) return [];
  const id = `${g.key}:score:${g.away.score}-${g.home.score}`;
  const text = line(g, g.away.score, g.home.score);
  if (da > 0 && dh > 0)
    return [{ id, kind: "score", title: "Score update", text, gameKey: g.key, mine: true }];
  const scorer = da > 0 ? g.away : g.home;
  return [
    {
      id,
      kind: "score",
      title: `${scorer.name}: ${scoreKind(g.league, Math.max(da, dh))}`,
      text,
      gameKey: g.key,
      mine: true,
    },
  ];
}

export function detectAlerts(prev: AlertGame[] | null, next: AlertGame[]): SportsAlert[] {
  if (!prev) return [];
  const before = new Map(prev.map((g) => [g.key, g]));
  const out: SportsAlert[] = [];
  for (const g of next) {
    const p = before.get(g.key);
    if (!p || g.savedAt !== undefined || p.savedAt !== undefined) continue;
    const watched = g.mine || g.top;
    if (watched && p.state === "pre" && g.state === "in") {
      out.push({
        id: `${g.key}:kickoff`,
        kind: "kickoff",
        title: `Underway: ${title(g)}`,
        text: g.mine ? "Your team is live now." : "A Top 10 game is live now.",
        gameKey: g.key,
        mine: g.mine,
      });
    }
    if (watched && p.state === "in" && g.state === "in") out.push(...scoreAlerts(p, g));
    if (p.athletePlays !== undefined && g.athletePlays) {
      const seen = new Set(p.athletePlays.map((x) => x.id));
      for (const a of g.athletePlays) {
        if (seen.has(a.id) || !a.player) continue;
        out.push({
          id: `${g.key}:ath:${a.id}`,
          kind: "athlete",
          title: `${a.player}: ${a.kind}`,
          text: `${a.text} · ${line(g, a.away, a.home)}`,
          gameKey: g.key,
          mine: true,
        });
      }
    }
    if (watched && p.state !== "post" && g.state === "post") {
      out.push({
        id: `${g.key}:final`,
        kind: "final",
        title: `Final: ${line(g, g.away.score, g.home.score)}`,
        text: g.finalLine ?? title(g),
        gameKey: g.key,
        mine: g.mine,
      });
    }
  }
  // An athlete's play is also the team's latest play: keep the athlete one.
  const athletePlayIds = new Set(
    out.filter((a) => a.kind === "athlete").map((a) => a.id.replace(":ath:", ":play:")),
  );
  return out.filter((a) => a.kind !== "score" || !athletePlayIds.has(a.id));
}

/** While the full-screen player is up, only your teams and athletes get through. */
export function alertsToShow(
  alerts: SportsAlert[],
  opts: { playerActive: boolean },
): SportsAlert[] {
  return opts.playerActive ? alerts.filter((a) => a.mine) : alerts;
}
