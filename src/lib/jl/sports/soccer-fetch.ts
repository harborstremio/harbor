import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, type SportsGame } from "@/lib/sports/espn";
import { parseSoccerLive, type SoccerLive } from "./soccer-live";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";

/** Live soccer: score, clock, possession and shots, scorers, and the event feed with locations. */
export async function fetchSoccerLive(
  game: SportsGame,
  signal?: AbortSignal,
): Promise<SoccerLive | null> {
  const path = leaguePath(game.league);
  if (!path || !/^\d{1,12}$/.test(game.id)) return null;
  const res = await safeFetch(`${SITE}/${path}/summary?event=${game.id}`, { signal });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return parseSoccerLive(await res.json());
}
