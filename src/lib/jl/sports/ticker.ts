import type { SportsGame, SportsSide } from "../../sports/espn-types.ts";
import { isFavoriteGame, type JlFavoriteTeam } from "./rank.ts";

/**
 * Tickarr, the score ticker across the top of the hubs: today's games on a schedule of five
 * minutes on and three off. The schedule follows the wall clock, so every ticker on screen (the
 * bar and the player overlay) shows and hides together.
 */
export const TICKER_ON_MS = 5 * 60_000;
export const TICKER_OFF_MS = 3 * 60_000;
export const TICKER_LIMIT = 40;

const CYCLE_MS = TICKER_ON_MS + TICKER_OFF_MS;
const COLLEGE = new Set(["NCAAF", "NCAAB"]);
const PRO_NICKNAMES = new Set(["NFL", "NBA", "NHL", "MLB"]);

const cyclePos = (ms: number) => ((ms % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;

/** Is this moment in the "on" part of the cycle? */
export function tickerOnAt(ms: number): boolean {
  return cyclePos(ms) < TICKER_ON_MS;
}

/** Milliseconds until the ticker next shows or hides. */
export function msToTickerFlip(ms: number): number {
  const pos = cyclePos(ms);
  return pos < TICKER_ON_MS ? TICKER_ON_MS - pos : CYCLE_MS - pos;
}

function sameLocalDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export type TickerGame = { game: SportsGame; mine: boolean };

/**
 * Today's games across JL's leagues: everything live, plus today's kick-offs and finals. Your
 * teams lead, then live games, then the rest by start time.
 */
export function selectTickerGames(
  games: SportsGame[],
  favorites: JlFavoriteTeam[],
  now: number,
  limit = TICKER_LIMIT,
): TickerGame[] {
  const seen = new Set<string>();
  const picked: TickerGame[] = [];
  for (const game of games) {
    const key = `${game.league}:${game.id}`;
    if (seen.has(key)) continue;
    if (game.state !== "in" && !(game.startMs && sameLocalDay(game.startMs, now))) continue;
    seen.add(key);
    picked.push({ game, mine: isFavoriteGame(game, favorites) });
  }
  return picked
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        Number(b.game.state === "in") - Number(a.game.state === "in") ||
        a.game.startMs - b.game.startMs,
    )
    .slice(0, limit);
}

export type TickerStatus =
  | { kind: "live"; detail: string }
  | { kind: "final"; detail: string }
  | { kind: "time"; startMs: number };

/** Live with the clock or period, the final, or the kick-off time (formatted by the caller). */
export function tickerStatus(game: SportsGame): TickerStatus {
  if (game.state === "in") return { kind: "live", detail: game.detail };
  if (game.state === "post") return { kind: "final", detail: game.detail };
  return { kind: "time", startMs: game.startMs };
}

/** The short name a crawl has room for: "Ohio State", "Chiefs", "Arsenal". */
export function tickerTeamName(side: SportsSide, league: string): string {
  if (COLLEGE.has(league)) return side.location || side.name;
  if (PRO_NICKNAMES.has(league)) return side.nickname || side.abbr || side.name;
  return side.name || side.abbr;
}

/** What an upcoming game adds after the teams: its network, and the line when odds are allowed. */
export function tickerExtras(game: SportsGame, showOdds: boolean): string[] {
  if (game.state !== "pre") return [];
  const extras: string[] = [];
  if (game.network) extras.push(game.network);
  if (showOdds && game.odds) extras.push(game.odds);
  return extras;
}
