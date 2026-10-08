import { safeFetch } from "@/lib/safe-fetch";
import { fetchSports, LEAGUES, type LeagueDef, type SportsGame } from "@/lib/sports/espn";
import { asBase, asSearchSlug, asSportFor, parseAsEvents, pickAsTeam, type AsTeamGame } from "./as-team-games";
import { parseAthlete, parseGameLog, type AthleteProfile, type GameLog } from "./espn-athlete";
import {
  corePath,
  parseCoreAthlete,
  parseLeaders,
  parseLeagueTeams,
  parseStandings,
  type LeaderCategory,
  type LeagueTeam,
  type StandingGroup,
} from "./espn-league";
import { parseRoster, parseSummaryLeaders, parseTeamInfo, type LeaderEntry, type Roster, type TeamInfo } from "./espn-team";
import { fetchJlScoreboard } from "./feed";

/** Data for the team, athlete and league pages, from ESPN's public APIs (no key). */

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const SITE_V3 = "https://site.api.espn.com/apis/site/v3/sports";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";

const MIN = 60_000;
const ID = /^\d{1,12}$/;

/** A Harbor league by key ("NCAAB") or by the tag games carry ("NCAA"). */
export function findLeague(keyOrTag: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.key === keyOrTag) ?? LEAGUES.find((l) => l.tag === keyOrTag);
}

type Entry = { at: number; value: unknown };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/** GET JSON, shared by every caller and kept for `ttl`; null when ESPN refuses or the network fails. */
function getJson(url: string, ttl: number, init?: RequestInit): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  const running = inflight.get(url);
  if (running) return running;
  const p = safeFetch(url, init)
    .then(async (res) => (res.ok ? ((await res.json()) as unknown) : null))
    .catch(() => null)
    .then((value) => {
      if (value != null) cache.set(url, { at: Date.now(), value });
      return value ?? hit?.value ?? null;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export async function fetchTeamInfo(league: string, teamId: string): Promise<TeamInfo | null> {
  const def = findLeague(league);
  if (!def || !ID.test(teamId)) return null;
  return parseTeamInfo(await getJson(`${SITE}/${def.path}/teams/${teamId}`, 10 * MIN));
}

export async function fetchRoster(league: string, teamId: string): Promise<Roster> {
  const def = findLeague(league);
  if (!def || !ID.test(teamId)) return { players: [], coach: null };
  return parseRoster(await getJson(`${SITE}/${def.path}/teams/${teamId}/roster`, 60 * MIN));
}

/** A team's leaders from one game's summary. */
export async function fetchTeamLeaders(game: SportsGame, teamId: string): Promise<LeaderEntry[]> {
  const def = findLeague(game.league);
  if (!def || !ID.test(game.id)) return [];
  const ttl = game.state === "in" ? MIN : 10 * MIN;
  return parseSummaryLeaders(await getJson(`${SITE}/${def.path}/summary?event=${game.id}`, ttl), teamId);
}

export async function fetchStandings(league: string): Promise<StandingGroup[]> {
  const def = findLeague(league);
  if (!def) return [];
  return parseStandings(await getJson(`${STANDINGS}/${def.path}/standings`, 15 * MIN));
}

const TEAMS_QUERY: Record<string, string> = {
  NCAAF: "?groups=80&limit=1000",
  NCAAB: "?groups=50&limit=1000",
};

export async function fetchLeagueTeams(league: string): Promise<LeagueTeam[]> {
  const def = findLeague(league);
  if (!def) return [];
  return parseLeagueTeams(await getJson(`${SITE}/${def.path}/teams${TEAMS_QUERY[def.key] ?? "?limit=1000"}`, 24 * 60 * MIN));
}

const LEADER_CATEGORIES = 6;
const LEADERS_EACH = 5;

/**
 * League leaders: the site API inlines athletes; when it has nothing, the core API lists references,
 * and the shown athletes are looked up (a handful, cached for an hour).
 */
export async function fetchLeagueLeaders(league: string): Promise<LeaderCategory[]> {
  const def = findLeague(league);
  if (!def) return [];
  const site = parseLeaders(await getJson(`${SITE_V3}/${def.path}/leaders`, 30 * MIN), LEADERS_EACH);
  if (site.length > 0) return site.slice(0, LEADER_CATEGORIES);
  const core = corePath(def.path);
  if (!core) return [];
  const cats = parseLeaders(await getJson(`${CORE}/${core}/leaders`, 30 * MIN), LEADERS_EACH).slice(
    0,
    LEADER_CATEGORIES,
  );
  return Promise.all(
    cats.map(async (c) => ({
      ...c,
      leaders: await Promise.all(
        c.leaders.map(async (l) => {
          if (l.name || !l.ref) return l;
          const a = parseCoreAthlete(await getJson(l.ref, 60 * MIN));
          return { ...l, name: a.name, headshot: l.headshot ?? a.headshot };
        }),
      ),
    })),
  ).then((list) =>
    list
      .map((c) => ({ ...c, leaders: c.leaders.filter((l) => l.name) }))
      .filter((c) => c.leaders.length > 0),
  );
}

/** Today's games for a league, or its most recent matchday when nothing is on. */
export async function fetchLeagueGames(league: string): Promise<SportsGame[]> {
  const def = findLeague(league);
  if (!def) return [];
  const today = await fetchJlScoreboard(def.tag);
  return today.length > 0 ? today : fetchSports([def.key]);
}

export async function fetchAthlete(league: string, athleteId: string): Promise<AthleteProfile | null> {
  const def = findLeague(league);
  if (!def || !ID.test(athleteId)) return null;
  return parseAthlete(await getJson(`${WEB}/${def.path}/athletes/${athleteId}`, 60 * MIN));
}

export async function fetchGameLog(league: string, athleteId: string): Promise<GameLog | null> {
  const def = findLeague(league);
  if (!def || !ID.test(athleteId)) return null;
  const doc = await getJson(`${WEB}/${def.path}/athletes/${athleteId}/gamelog`, 30 * MIN);
  return doc ? parseGameLog(doc, def.tag) : null;
}

// Minimal AllSports read for the team page when ESPN has no schedule; the viewer's own key.
// TODO(sports): fold into the shared AllSports client (src/lib/jl/sports/allsports.ts).
const ALLSPORTS = "https://prod.api.market/api/v1/recodex/allsportsapi";

export type AsTeamSchedule = { sport: string; upcoming: AsTeamGame[]; results: AsTeamGame[] };

export async function fetchAsTeamSchedule(key: string, league: string, teamName: string): Promise<AsTeamSchedule | null> {
  const def = findLeague(league);
  const sport = def ? asSportFor(def.tag, def.group) : null;
  const q = asSearchSlug(teamName);
  if (!key || !sport || q.length < 2) return null;
  const init = { headers: { "x-api-market-key": key, Accept: "application/json" } };
  const base = `${ALLSPORTS}${asBase(sport)}`;
  const id = pickAsTeam(await getJson(`${base}/search/${q}`, 24 * 60 * MIN, init), teamName);
  if (!id) return null;
  const [next, prev] = await Promise.all([
    getJson(`${base}/team/${id}/matches/next/0`, 15 * MIN, init),
    getJson(`${base}/team/${id}/matches/previous/0`, 15 * MIN, init),
  ]);
  return {
    sport,
    upcoming: parseAsEvents(next)
      .filter((g) => g.state !== "post")
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 10),
    results: parseAsEvents(prev)
      .filter((g) => g.state === "post")
      .sort((a, b) => b.startMs - a.startMs)
      .slice(0, 10),
  };
}
