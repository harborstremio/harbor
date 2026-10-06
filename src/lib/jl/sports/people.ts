import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, type SportsGame } from "@/lib/sports/espn";
import type { JlFavoritePlayer } from "./favorites";
import { parsePlayerLine, parsePregame, type PlayerLine, type PregameInsight } from "./insight";
import { parseAthleteForFollow, parseSearchResults, type SportsSearchHit } from "./search-parse";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const WEB = "https://site.web.api.espn.com/apis";

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await safeFetch(url, { signal });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

export async function searchTeamsAndPlayers(query: string, signal?: AbortSignal): Promise<SportsSearchHit[]> {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  return parseSearchResults(await getJson(`${WEB}/search/v2?query=${encodeURIComponent(q)}&limit=20`, signal));
}

/** A search hit as a followed player, with their current team so Game Day follows it too. */
export async function playerForFollow(hit: SportsSearchHit): Promise<JlFavoritePlayer> {
  const path = leaguePath(hit.league);
  const doc = path ? await getJson(`${WEB}/common/v3/sports/${path}/athletes/${hit.id}`).catch(() => null) : null;
  const details = parseAthleteForFollow(doc);
  return { league: hit.league, id: hit.id, name: hit.name, ...details, headshot: details.headshot ?? hit.image };
}

export async function fetchPregameInsight(game: SportsGame, signal?: AbortSignal): Promise<PregameInsight> {
  const path = leaguePath(game.league);
  if (!path || !/^\d{1,12}$/.test(game.id)) return { away: null, home: null };
  return parsePregame(await getJson(`${SITE}/${path}/summary?event=${game.id}`, signal));
}

export async function fetchPlayerLine(player: JlFavoritePlayer, signal?: AbortSignal): Promise<PlayerLine | null> {
  const path = leaguePath(player.league);
  if (!path) return null;
  return parsePlayerLine(await getJson(`${WEB}/common/v3/sports/${path}/athletes/${player.id}`, signal));
}
