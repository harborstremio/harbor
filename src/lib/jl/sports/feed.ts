import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, parseLeagueEvents, type SportsGame } from "@/lib/sports/espn";
import { scheduleEventsToScoreboard } from "./gameday";

const BASE = "https://site.api.espn.com/apis/site/v2/sports";
// College football's default scoreboard is a handful of featured games; Game Day needs the whole
// FBS week. Smaller schools (FCS, Division II/III) come from their own team schedules.
const SCOREBOARD_QUERY: Record<string, string> = { NCAAF: "?groups=80&limit=200" };
const SCOREBOARD_TTL_MS = 30_000;
const SCHEDULE_TTL_MS = 5 * 60_000;
const LIVE_SCHEDULE_TTL_MS = 30_000;

type Entry = { at: number; ttl: number; games: SportsGame[] };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<SportsGame[]>>();

async function cached(key: string, load: () => Promise<{ games: SportsGame[]; ttl: number }>): Promise<SportsGame[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.games;
  const running = inflight.get(key);
  if (running) return running;
  const p = load()
    .then(({ games, ttl }) => {
      cache.set(key, { at: Date.now(), ttl, games });
      return games;
    })
    .catch(() => hit?.games ?? [])
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getJson(url: string): Promise<{ events?: unknown[] } | null> {
  const res = await safeFetch(url);
  if (!res.ok) return null;
  return (await res.json()) as { events?: unknown[] };
}

export function fetchJlScoreboard(league: string): Promise<SportsGame[]> {
  const path = leaguePath(league);
  if (!path) return Promise.resolve([]);
  return cached(`board:${league}`, async () => {
    const data = await getJson(`${BASE}/${path}/scoreboard${SCOREBOARD_QUERY[league] ?? ""}`);
    return { games: parseLeagueEvents(data?.events ?? [], league), ttl: SCOREBOARD_TTL_MS };
  });
}

export function fetchTeamGames(league: string, teamId: string): Promise<SportsGame[]> {
  const path = leaguePath(league);
  if (!path || !/^\d{1,12}$/.test(teamId)) return Promise.resolve([]);
  return cached(`team:${league}:${teamId}`, async () => {
    const data = await getJson(`${BASE}/${path}/teams/${teamId}/schedule`);
    const games = parseLeagueEvents(scheduleEventsToScoreboard(data?.events ?? []), league);
    const live = games.some((g) => g.state === "in");
    return { games, ttl: live ? LIVE_SCHEDULE_TTL_MS : SCHEDULE_TTL_MS };
  });
}
