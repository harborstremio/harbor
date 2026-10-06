import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { teamKey } from "./event-parse.ts";

/** A followed team: Harbor league tag ("NFL", "NCAAF", "NBA") + ESPN team id, and its name as a fallback. */
export type JlFavoriteTeam = { league: string; id: string; name: string };

export type RankReason = { label: string; vars?: Record<string, string | number> };

export type RankedGame = { game: SportsGame; score: number; reasons: RankReason[]; mine: boolean };

const FOOTBALL_SPORT: Record<string, "nfl" | "cfb"> = { NFL: "nfl", NCAAF: "cfb" };

const NATIONAL =
  /^(ABC|CBS|NBC|FOX|FOX Sports|ESPN|ESPN2|FS1|FS2|BTN|Big Ten Network|SEC Network|ACC Network|CBS Sports Network|CBSSN|TNT|Prime Video|Peacock|NFL Network|NFL Net)$/i;

// Words that make a different school when they follow a name: "Ohio" ≠ "Ohio State", "Texas" ≠ "Texas Tech".
const NOT_A_MASCOT =
  /^(state|saint|st|tech|a and m|christian|southern|central|northern|eastern|western|international|baptist|methodist|lutheran|wesleyan|poly|pacific|atlantic|university|college|valley|mountain|tennessee|carolina|kentucky|michigan|illinois|florida|georgia)\b/;

function nameMatches(favoriteName: string, name: string | undefined): boolean {
  if (!name) return false;
  const k = teamKey(name);
  const fk = teamKey(favoriteName);
  if (!k || !fk) return false;
  if (fk === k) return true;
  if (!fk.startsWith(`${k} `)) return false;
  return !NOT_A_MASCOT.test(fk.slice(k.length + 1));
}

/**
 * Is this one of your teams? By ESPN id when both sides have one (exact); otherwise by name, where
 * only a mascot may follow ("Oregon" = "Oregon Ducks", but "Ohio" ≠ "Ohio State Buckeyes").
 */
export function isFavoriteSide(
  side: Pick<SportsSide, "name" | "id" | "location">,
  league: string,
  favorites: JlFavoriteTeam[],
): boolean {
  return favorites.some((f) => {
    if (f.league !== league) return false;
    if (side.id && f.id) return f.id === side.id;
    return nameMatches(f.name, side.name) || nameMatches(f.name, side.location);
  });
}

export function isFavoriteGame(game: SportsGame, favorites: JlFavoriteTeam[]): boolean {
  return isFavoriteSide(game.home, game.league, favorites) || isFavoriteSide(game.away, game.league, favorites);
}

/**
 * Odds are an importance signal, not just decoration: a close line usually means a competitive,
 * nationally relevant game; a very high total an explosive one. Kept below AP rankings and your
 * own teams so betting data never becomes the whole ranking.
 */
function oddsInterest(label: string | null | undefined): { score: number; reasons: RankReason[] } {
  if (!label) return { score: 0, reasons: [] };
  const reasons: RankReason[] = [];
  let score = 0;
  const spread = /(?:[+\-−])(\d+(?:\.\d+)?)/.exec(label);
  const pick = /pick[ '’-]?em|\bEVEN\b/i.test(label);
  const points = pick ? 0 : spread ? Number(spread[1]) : null;
  if (points != null && points <= 3.5) {
    score += 20;
    reasons.push({ label: "Close line" });
  } else if (points != null && points <= 7) {
    score += 12;
    reasons.push({ label: "Competitive line" });
  } else if (points != null && points <= 10) {
    score += 5;
  }
  const total = Number(/O\/U\s*(\d+(?:\.\d+)?)/i.exec(label)?.[1]);
  if (Number.isFinite(total) && total >= 60) {
    score += 8;
    reasons.push({ label: "High-scoring line" });
  }
  return { score, reasons };
}

function dayWeights(now: Date): Record<"nfl" | "cfb", number> {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short" }).format(now);
  const byDay: Record<string, Record<"nfl" | "cfb", number>> = {
    Sat: { cfb: 30, nfl: 10 },
    Sun: { cfb: 5, nfl: 40 },
    Mon: { cfb: 5, nfl: 40 },
    Thu: { cfb: 15, nfl: 40 },
    Fri: { cfb: 20, nfl: 20 },
  };
  return byDay[day] ?? { cfb: 10, nfl: 10 };
}

/**
 * Top games: your teams, AP rankings, competitive odds, national TV, then live timing. Being on one
 * of your channels is a small tie-breaker: it controls the Watch button, not whether a marquee game
 * belongs at the top. Finished games drop out.
 */
export function rankGames(
  games: SportsGame[],
  favorites: JlFavoriteTeam[],
  opts: { now: Date; watchable?: (game: SportsGame) => boolean },
): RankedGame[] {
  const { now, watchable } = opts;
  const weights = dayWeights(now);
  return games
    .filter((g) => g.state !== "post")
    .map((game) => {
      const reasons: RankReason[] = [];
      const sport = FOOTBALL_SPORT[game.league];
      let score = (sport ? weights[sport] : 10) + (watchable?.(game) ? 6 : 0);
      const mine = isFavoriteGame(game, favorites);
      if (mine) {
        score += 100;
        const hoursAway = (game.startMs - now.getTime()) / 3600000;
        reasons.push({ label: hoursAway > 20 ? "Your team · next game" : "Your team" });
      }
      const ranks = [game.away.rank, game.home.rank].filter((r): r is number => !!r);
      if (ranks.length === 2) {
        score += 100 + (52 - ranks[0] - ranks[1]);
        reasons.push({ label: "#{a} vs #{b}", vars: { a: ranks[0], b: ranks[1] } });
      } else if (ranks.length === 1) {
        score += 50 + (26 - ranks[0]);
        reasons.push({ label: "Top 25 · #{n}", vars: { n: ranks[0] } });
      }
      const betting = oddsInterest(game.odds);
      score += betting.score;
      reasons.push(...betting.reasons);
      const minutes = (game.startMs - now.getTime()) / 60000;
      if (game.state === "in") {
        score += 25;
        reasons.push({ label: "Live" });
      } else if (minutes <= 90) {
        score += 12;
        reasons.push({ label: "Starts soon" });
      } else if (minutes > 6 * 60) {
        score -= 10;
      }
      if (game.network && NATIONAL.test(game.network)) {
        score += 50;
        reasons.push({ label: "On {network}", vars: { network: game.network } });
      }
      return { game, score, reasons, mine };
    })
    .sort((a, b) => b.score - a.score || a.game.startMs - b.game.startMs);
}
