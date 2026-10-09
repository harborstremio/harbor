import type { SportsGame } from "./espn-types";

/** TheSportsDB's zone-less event timestamps are UTC, not the viewer's local time. */
export function sportsDbTimestamp(
  timestamp: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
) {
  const raw = timestamp || `${date}T${time || "00:00:00"}`;
  return Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
}

export function isGameOnLocalDay(game: SportsGame, day: string) {
  const date = new Date(game.startMs);
  return (
    date.getFullYear() === Number(day.slice(0, 4)) &&
    date.getMonth() + 1 === Number(day.slice(4, 6)) &&
    date.getDate() === Number(day.slice(6, 8))
  );
}

/** Tournament scoreboards include earlier rounds; apply the day to each match. */
export function filterCachedTournament(key: string, games: SportsGame[]) {
  const [league, day, mode] = key.split("@");
  if (mode !== "day" || !["TENNIS", "TENNIS_WTA"].includes(league)) return games;
  const filtered = games.filter((game) => isGameOnLocalDay(game, day));
  return filtered.length === games.length ? games : filtered;
}
