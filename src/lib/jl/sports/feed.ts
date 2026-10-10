import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, parseLeagueEvents, type SportsGame } from "@/lib/sports/espn";
import { scheduleEventsToScoreboard } from "./gameday";
import { createSportsFeedCache, scoreboardEvents } from "./feed-cache";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
// College football's default scoreboard is a handful of featured games; Game Day needs the whole
// FBS week. Smaller schools (FCS, Division II/III) come from their own team schedules.
const SCOREBOARD_QUERY: Record<string, string> = { NCAAF: "?groups=80&limit=200" };
const SCOREBOARD_TTL_MS = 30_000;
const SCHEDULE_TTL_MS = 5 * 60_000;
const LIVE_SCHEDULE_TTL_MS = 30_000;

const cached = createSportsFeedCache();

async function getEvents(url: string): Promise<unknown[]> {
  const res = await safeFetch(url);
  if (!res.ok) throw new Error("Sports schedule request failed");
  return scoreboardEvents(await res.json());
}

export function fetchJlScoreboard(league: string): Promise<SportsGame[]> {
  const path = leaguePath(league);
  if (!path) return Promise.resolve([]);
  return cached(`board:${league}`, async () => {
    const events = await getEvents(`${BASE}/${path}/scoreboard${SCOREBOARD_QUERY[league] ?? ""}`);
    return { games: parseLeagueEvents(events, league), ttl: SCOREBOARD_TTL_MS };
  });
}

export function fetchTeamGames(league: string, teamId: string): Promise<SportsGame[]> {
  const path = leaguePath(league);
  if (!path || !/^\d{1,12}$/.test(teamId)) return Promise.resolve([]);
  return cached(`team:${league}:${teamId}`, async () => {
    const events = await getEvents(`${BASE}/${path}/teams/${teamId}/schedule`);
    const games = parseLeagueEvents(scheduleEventsToScoreboard(events), league);
    const live = games.some((g) => g.state === "in");
    return { games, ttl: live ? LIVE_SCHEDULE_TTL_MS : SCHEDULE_TTL_MS };
  });
}
