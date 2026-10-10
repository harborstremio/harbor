import type { SportsGame } from "../../sports/espn.ts";
import { isFavoriteGame, type JlFavoriteTeam, type RankedGame } from "./rank.ts";

/**
 * Game Day: the Top 10 is the week's best games plus every followed team's next game this week,
 * whatever its level (an FBS showdown and a Division III school like Gallaudet alike).
 */

export const TOP_GAMES = 10;
const WEEK_MS = 7 * 24 * 3600000;

type Rec = Record<string, unknown>;

/**
 * ESPN team-schedule events differ from scoreboard events: a competitor's score is an object
 * ({ displayValue }) and the team carries `logos[]` instead of `logo`. This reshapes them so the
 * scoreboard parser reads them unchanged.
 */
export function scheduleEventsToScoreboard(events: unknown[]): unknown[] {
  return events.map((raw) => {
    const ev = (raw ?? {}) as Rec;
    const comps = Array.isArray(ev.competitions) ? (ev.competitions as Rec[]) : [];
    return {
      ...ev,
      // Team schedules put the status on the competition; the scoreboard parser reads it from there too.
      competitions: comps.map((comp) => ({
        ...comp,
        competitors: (Array.isArray(comp.competitors) ? (comp.competitors as Rec[]) : []).map((c) => {
          const team = (c.team ?? {}) as Rec;
          const logos = Array.isArray(team.logos) ? (team.logos as Rec[]) : [];
          const score = c.score as Rec | string | number | undefined;
          return {
            ...c,
            score:
              score && typeof score === "object"
                ? String(score.displayValue ?? score.value ?? "")
                : score == null
                  ? ""
                  : String(score),
            team: { ...team, logo: typeof team.logo === "string" ? team.logo : (logos[0]?.href ?? "") },
          };
        }),
      })),
    };
  });
}

/** Followed teams with no game in `games`: their schedules must be fetched separately. */
export function teamsMissingFromScoreboard(games: SportsGame[], favorites: JlFavoriteTeam[]): JlFavoriteTeam[] {
  return favorites.filter(
    (f) =>
      !!f.id &&
      !games.some((g) => g.league === f.league && (g.home.id === f.id || g.away.id === f.id)),
  );
}

/** Each followed team's next game within a week (or its game on now). */
export function followedGamesThisWeek(
  games: SportsGame[],
  favorites: JlFavoriteTeam[],
  now: Date,
): SportsGame[] {
  const nowMs = now.getTime();
  const picked = new Map<string, SportsGame>();
  const sorted = games
    .filter((g) => g.state !== "post" && g.startMs > 0 && g.startMs - nowMs <= WEEK_MS)
    .sort((a, b) => a.startMs - b.startMs);
  for (const f of favorites) {
    const next = sorted.find((g) => isFavoriteGame(g, [f]));
    if (next) picked.set(next.id, next);
  }
  return [...picked.values()];
}

/**
 * Top 10: followed teams' games are guaranteed a place; the rest are the best-ranked games.
 * The result keeps ranking order so the biggest game still leads.
 */
export function selectTopGames(
  ranked: RankedGame[],
  followed: SportsGame[],
  size = TOP_GAMES,
): RankedGame[] {
  const followedIds = new Set(followed.map((g) => g.id));
  const mine = ranked.filter((r) => followedIds.has(r.game.id)).slice(0, size);
  // A followed team's later games this week don't take slots from the week's top games.
  const rest = ranked
    .filter((r) => !followedIds.has(r.game.id) && !r.mine)
    .slice(0, Math.max(0, size - mine.length));
  return [...mine, ...rest].sort((a, b) => b.score - a.score || a.game.startMs - b.game.startMs);
}
