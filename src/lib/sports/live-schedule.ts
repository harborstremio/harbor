import type { LeagueDef, SportsGame } from "./espn-types";
import { utcCalendarDates } from "./motorsport-schedule-cache";

/** One aggregate football feed; all other scoreboards once, independent of favorites. */
export function liveScoreboardKeys(leagues: LeagueDef[]): string[] {
  const paths = new Set<string>();
  const keys: string[] = [];
  for (const league of leagues) {
    if (league.group === "esports" || !league.path.includes("/")) continue;
    const path = league.group === "soccer" ? "soccer/all" : league.path;
    if (paths.has(path)) continue;
    paths.add(path);
    keys.push(league.group === "soccer" ? "SOCCER_ALL" : league.key);
  }
  return keys;
}

/** Include games continuing through midnight without doubling requests per league. */
export function liveDateRange(today: string): string {
  const previous = new Date(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8));
  previous.setDate(previous.getDate() - 1);
  const previousDay = `${previous.getFullYear()}${String(previous.getMonth() + 1).padStart(2, "0")}${String(previous.getDate()).padStart(2, "0")}`;
  const dates = [...utcCalendarDates(previousDay), ...utcCalendarDates(today)].sort();
  return `${dates[0].replaceAll("-", "")}-${dates.at(-1)!.replaceAll("-", "")}`;
}

export function currentLiveGames(games: SportsGame[]): SportsGame[] {
  return games.filter((game) => game.state === "in" && game.savedAt === undefined);
}
