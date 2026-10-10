import { safeFetch } from "@/lib/safe-fetch";
import { leaguePath, parseLeagueEvents, type SportsGame } from "@/lib/sports/espn";
import type { JlFavoritePlayer } from "./favorites";
import { parsePlayerLine, parsePregame, type PlayerLine, type PregameInsight } from "./insight";
import { parseFootballSituation, type FootballSituation } from "./live-field";
import { parseAthleteForFollow, parseSearchResults, type SportsSearchHit } from "./search-parse";

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const WEB = "https://site.web.api.espn.com/apis";

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await safeFetch(url, { signal });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

export async function searchTeamsAndPlayers(
  query: string,
  signal?: AbortSignal,
): Promise<SportsSearchHit[]> {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return [];
  return parseSearchResults(
    await getJson(`${WEB}/search/v2?query=${encodeURIComponent(q)}&limit=20`, signal),
  );
}

/** A search hit as a followed player, with their current team so Game Day follows it too. */
export async function playerForFollow(hit: SportsSearchHit): Promise<JlFavoritePlayer> {
  const path = leaguePath(hit.league);
  const doc = path
    ? await getJson(`${WEB}/common/v3/sports/${path}/athletes/${hit.id}`).catch(() => null)
    : null;
  const details = parseAthleteForFollow(doc);
  return {
    league: hit.league,
    id: hit.id,
    name: hit.name,
    ...details,
    headshot: details.headshot ?? hit.image,
  };
}

export async function fetchPregameInsight(
  game: SportsGame,
  signal?: AbortSignal,
): Promise<PregameInsight> {
  const path = leaguePath(game.league);
  if (!path || !/^\d{1,12}$/.test(game.id)) return { away: null, home: null };
  return parsePregame(await getJson(`${SITE}/${path}/summary?event=${game.id}`, signal));
}

/** Live US football: the ball, down and distance, last play, and the game's current leaders. */
export async function fetchFootballLive(
  game: SportsGame,
  signal?: AbortSignal,
): Promise<{ game: SportsGame; situation: FootballSituation | null; insight: PregameInsight }> {
  const path = leaguePath(game.league);
  if (!path || !/^\d{1,12}$/.test(game.id))
    return { game, situation: null, insight: { away: null, home: null } };
  const summary = (await getJson(`${SITE}/${path}/summary?event=${game.id}`, signal)) as {
    header?: { competitions?: Array<{ date?: string }> };
  } | null;
  // The summary header has the scoreboard's shape: the current score, clock and state.
  const competitions = summary?.header?.competitions ?? [];
  const fresh = parseLeagueEvents(
    [{ id: game.id, date: competitions[0]?.date, competitions }],
    game.league,
  )[0];
  return {
    game: fresh
      ? {
          ...game,
          savedAt: undefined,
          state: fresh.state,
          detail: fresh.detail,
          home: fresh.home,
          away: fresh.away,
        }
      : game,
    situation: parseFootballSituation(summary, {
      home: { id: game.home.id, abbr: game.home.abbr },
      away: { id: game.away.id, abbr: game.away.abbr },
    }),
    insight: parsePregame(summary),
  };
}

export async function fetchPlayerLine(
  player: JlFavoritePlayer,
  signal?: AbortSignal,
): Promise<PlayerLine | null> {
  const path = leaguePath(player.league);
  if (!path) return null;
  return parsePlayerLine(
    await getJson(`${WEB}/common/v3/sports/${path}/athletes/${player.id}`, signal),
  );
}
