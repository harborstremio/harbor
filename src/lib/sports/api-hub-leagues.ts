import type { SportsGame } from "./espn-types";
import { utcCalendarDates } from "./motorsport-schedule-cache";
import { isGameOnLocalDay } from "./slice-calendar";

/** Explicit competition aliases only. Provider team/event IDs remain source-specific. */
const HUB_TO_API: Record<string, string> = { EGYPT: "EGY", QATAR: "QSL", UAE: "UAE", KHL: "KHL" };
export function apiLeagueForHub(key: string): string | undefined {
  return HUB_TO_API[key];
}

export async function optionalApiHubSlice(
  league: string,
  day: string,
  mode: string | undefined,
  signal: AbortSignal,
  fetch: (league: string, date: string, signal: AbortSignal) => Promise<SportsGame[]>,
): Promise<SportsGame[] | null> {
  const apiLeague = apiLeagueForHub(league);
  if (!apiLeague || mode === "upcoming") return null;
  signal.throwIfAborted();
  try {
    const pages = await Promise.all(
      utcCalendarDates(day).map((date) => fetch(apiLeague, date.replaceAll("-", ""), signal)),
    );
    signal.throwIfAborted();
    return [
      ...new Map(
        pages.flat().map((game) => [game.id, { ...game, league, source: "api-sports" }]),
      ).values(),
    ].filter((game) => isGameOnLocalDay(game, day) && (mode !== "live" || game.state === "in"));
  } catch {
    signal.throwIfAborted();
    return null;
  }
}
