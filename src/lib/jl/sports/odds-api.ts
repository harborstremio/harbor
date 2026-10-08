import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { teamKey } from "./event-parse.ts";
import { ODDS_API_BASE } from "./sports-keys.ts";

/**
 * Moneyline and spread from The Odds API (the viewer's own key). The free plan allows about
 * 500 requests a month, so only leagues with upcoming or live games on screen are asked, at
 * most once every 6 hours each, and the answer is kept across restarts.
 */

/** The Odds API sport key for each JL league key. */
const SPORT_KEY: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NCAAF: "americanfootball_ncaaf",
  NBA: "basketball_nba",
  NCAAB: "basketball_ncaab",
  NHL: "icehockey_nhl",
  MLB: "baseball_mlb",
  EPL: "soccer_epl",
  UCL: "soccer_uefa_champs_league",
  UEL: "soccer_uefa_europa_league",
  MLS: "soccer_usa_mls",
  LALIGA: "soccer_spain_la_liga",
  SERIEA: "soccer_italy_serie_a",
  BUNDESLIGA: "soccer_germany_bundesliga",
  LIGUE1: "soccer_france_ligue_one",
  UFC: "mma_mixed_martial_arts",
};

export function oddsSportKey(league: string): string | null {
  return SPORT_KEY[league] ?? null;
}

export const ODDS_TTL_MS = 6 * 3600_000;
const MATCH_WINDOW_MS = 12 * 3600_000;
const BOOKS = ["draftkings", "fanduel", "betmgm", "caesars"];

export function oddsUrl(key: string, sportKey: string): string {
  return `${ODDS_API_BASE}/sports/${sportKey}/odds/?regions=us&markets=h2h,spreads&oddsFormat=american&apiKey=${encodeURIComponent(key)}`;
}

export type OddsLine = {
  home: string;
  away: string;
  startMs: number;
  /** American moneyline per team name; "Draw" for three-way markets. */
  moneyline: Record<string, number>;
  /** The favourite's spread (negative point). */
  spread: { team: string; point: number } | null;
};

type Outcome = { name?: unknown; price?: unknown; point?: unknown };
type Market = { key?: unknown; outcomes?: unknown };
type Bookmaker = { key?: unknown; markets?: unknown };

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Maps The Odds API's /odds answer to one line per event (preferring the big US books). */
export function parseOddsEvents(body: unknown): OddsLine[] {
  const out: OddsLine[] = [];
  for (const raw of asArray<Record<string, unknown>>(body)) {
    const home = typeof raw.home_team === "string" ? raw.home_team : "";
    const away = typeof raw.away_team === "string" ? raw.away_team : "";
    const startMs = typeof raw.commence_time === "string" ? Date.parse(raw.commence_time) : NaN;
    if (!home || !away || !Number.isFinite(startMs)) continue;
    const books = asArray<Bookmaker>(raw.bookmakers);
    const market = (key: string): Outcome[] => {
      const ordered = [...BOOKS.map((b) => books.find((x) => x.key === b)), ...books];
      for (const book of ordered) {
        const m = asArray<Market>(book?.markets).find((x) => x.key === key);
        const outcomes = asArray<Outcome>(m?.outcomes);
        if (outcomes.length) return outcomes;
      }
      return [];
    };
    const moneyline: Record<string, number> = {};
    for (const o of market("h2h")) {
      if (typeof o.name === "string" && typeof o.price === "number") moneyline[o.name] = o.price;
    }
    const spreads = market("spreads").filter(
      (o): o is { name: string; point: number } => typeof o.name === "string" && typeof o.point === "number",
    );
    const fav = [...spreads].sort((a, b) => a.point - b.point)[0];
    out.push({ home, away, startMs, moneyline, spread: fav ? { team: fav.name, point: fav.point } : null });
  }
  return out;
}

/** True when an Odds API team name is this ESPN side ("Kansas City Chiefs" ↔ KC). */
export function sameTeam(side: Pick<SportsSide, "name" | "location" | "nickname">, oddsName: string): boolean {
  const o = teamKey(oddsName);
  if (!o) return false;
  const full = teamKey(side.name);
  if (full && (full === o || o.startsWith(`${full} `) || full.startsWith(`${o} `))) return true;
  const loc = side.location ? teamKey(side.location) : "";
  const nick = side.nickname ? teamKey(side.nickname) : "";
  if (loc && nick && o === `${loc} ${nick}`) return true;
  return false;
}

/** The odds line for a game: both teams match and kick-off is within 12 hours. */
export function findOddsLine(game: SportsGame, lines: OddsLine[]): OddsLine | null {
  return (
    lines.find(
      (l) =>
        Math.abs(l.startMs - game.startMs) < MATCH_WINDOW_MS &&
        ((sameTeam(game.home, l.home) && sameTeam(game.away, l.away)) ||
          (sameTeam(game.home, l.away) && sameTeam(game.away, l.home))),
    ) ?? null
  );
}

const fmtPoint = (n: number) => (n === 0 ? "PK" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`);
const fmtPrice = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;

/** "KC −3.5 · ML KC −180 / BUF +150" in the card's own team abbreviations. */
export function formatOddsLine(game: SportsGame, line: OddsLine): string | null {
  const label = (oddsName: string) => {
    if (oddsName === "Draw") return "Draw";
    const side = sameTeam(game.home, oddsName) ? game.home : sameTeam(game.away, oddsName) ? game.away : null;
    return side ? side.abbr || side.location || side.name : oddsName;
  };
  const parts: string[] = [];
  if (line.spread) {
    parts.push(line.spread.point === 0 ? "Pick ’em" : `${label(line.spread.team)} ${fmtPoint(line.spread.point)}`);
  }
  const ml: string[] = [];
  for (const name of [line.away, line.home, "Draw"]) {
    const price = line.moneyline[name];
    if (typeof price === "number") ml.push(`${label(name)} ${fmtPrice(price)}`);
  }
  if (ml.length) parts.push(`ML ${ml.join(" / ")}`);
  return parts.join(" · ") || null;
}

/** Leagues worth asking about: those with an upcoming or live game on screen. */
export function oddsLeaguesFor(games: SportsGame[]): string[] {
  const out = new Set<string>();
  for (const g of games) if (g.state !== "post" && oddsSportKey(g.league)) out.add(g.league);
  return [...out].sort();
}

/** Each game's odds label from The Odds API, or its ESPN line when there's no match. */
export function applyOddsLines(games: SportsGame[], linesByLeague: Record<string, OddsLine[] | undefined>): SportsGame[] {
  return games.map((g) => {
    const lines = linesByLeague[g.league];
    if (!lines) return g;
    const line = findOddsLine(g, lines);
    const label = line ? formatOddsLine(g, line) : null;
    return label ? { ...g, odds: label } : g;
  });
}

/* ---------------- Cache with expiry ---------------- */

export type OddsCacheEntry = { lines: OddsLine[]; expires: number };

export function parseOddsCache(raw: string | null, now: number): Record<string, OddsCacheEntry> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, OddsCacheEntry> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const e = v as Partial<OddsCacheEntry> | null;
    if (!e || typeof e.expires !== "number" || e.expires <= now || !Array.isArray(e.lines)) continue;
    out[k] = { lines: e.lines, expires: e.expires };
  }
  return out;
}
