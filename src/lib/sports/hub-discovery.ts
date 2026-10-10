import type { SportsGame } from "./espn-types";
import { gameKey } from "./hub-cache";

/** Keep discovery varied: a daily baseball schedule must not bury a race or fight night. */
export function diverseEvents(games: SportsGame[], limit = 18): SportsGame[] {
  const first = new Map<string, SportsGame>();
  for (const game of games) if (!first.has(game.league)) first.set(game.league, game);
  const seen = new Set<string>();
  return [...first.values(), ...games]
    .filter((game) => {
      const key = gameKey(game);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function featuredEvents(live: SportsGame[], upcoming: SportsGame[]): SportsGame[] {
  const ufc = upcoming.find((g) => g.league === "UFC" && /^UFC \d/.test(g.context?.name || ""));
  const pool = [
    ufc,
    ...live.slice(0, 2),
    upcoming.find((g) => g.league === "BOXING"),
    upcoming.find((g) => g.league === "F1"),
    upcoming.find((g) => g.league === "NBA"),
    ...diverseEvents(upcoming, 8),
  ];
  const seen = new Set<string>();
  return pool
    .filter((game): game is SportsGame => !!game)
    .filter((game) => {
      const key = game.context?.id ? `${game.league}:${game.context.id}` : gameKey(game);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}
