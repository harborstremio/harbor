import {
  currentEsportsMatches,
  type EsportsFeed,
  type EsportsGameId,
  type EsportsMatch,
} from "./esports-feeds";

/** A compact cross-game selection; only fresh provider states can occupy live slots. */
export function esportsRailMatches(feeds: EsportsFeed[], now = Date.now()): EsportsMatch[] {
  const matches = currentEsportsMatches(
    feeds.flatMap((feed) =>
      feed.matches.filter(
        (match) =>
          match.state !== "live" || (feed.status === "ready" && now - feed.fetchedAt < 3 * 60_000),
      ),
    ),
    now,
  );
  const live = matches.filter((match) => match.state === "live");
  const upcoming = matches.filter((match) => match.state === "upcoming");
  const perGame = new Map<string, number>();
  const first = upcoming.filter((match) => {
    const count = perGame.get(match.game) ?? 0;
    perGame.set(match.game, count + 1);
    return count < 3;
  });
  const selected = [...live, ...first, ...upcoming.filter((match) => !first.includes(match))];
  return (selected.length ? selected : matches.filter((match) => match.state === "recent")).slice(
    0,
    12,
  );
}

const LEAGUE_GAMES: Record<string, EsportsGameId> = {
  DOTA2: "dota2",
  CS2: "cs2",
  VALORANT: "valorant",
  LCK: "lol",
  LEC: "lol",
  LPL: "lol",
  RLCS: "rocketleague",
};

/** Undefined is global browsing; an explicit empty selection requests nothing. */
export function esportsRailGames(leagueKeys?: readonly string[]): EsportsGameId[] | undefined {
  return leagueKeys === undefined
    ? undefined
    : [...new Set(leagueKeys.flatMap((key) => (LEAGUE_GAMES[key] ? [LEAGUE_GAMES[key]] : [])))];
}

export function selectedEsportsFeeds(
  feeds: EsportsFeed[],
  leagueKeys?: readonly string[],
): EsportsFeed[] {
  if (leagueKeys === undefined) return feeds;
  const games = esportsRailGames(leagueKeys)!;
  return feeds
    .filter((feed) => games.includes(feed.game))
    .map((feed) => ({ ...feed, matches: lolSelection(feed.matches, leagueKeys) }));
}

const lolLeague = (match: EsportsMatch) => match.event.name.split("·")[0].trim().toUpperCase();

/** Chosen splits narrow LoL, but a week with none of them playing must not empty the game. */
function lolSelection(matches: EsportsMatch[], leagueKeys: readonly string[]): EsportsMatch[] {
  const lol = matches.filter((match) => match.game === "lol");
  if (!lol.length) return matches;
  const splits = leagueKeys.filter((key) => LEAGUE_GAMES[key] === "lol");
  const chosen = lol.filter((match) => splits.includes(lolLeague(match)));
  const keep = new Set(chosen.length ? chosen : lol);
  return matches.filter((match) => match.game !== "lol" || keep.has(match));
}

/**
 * Titles whose provider answered cleanly with nothing scheduled, which is a season break
 * rather than an outage. RLCS is the live case: its season ended and the next is unpublished.
 */
export function esportsOffseasonGames(feeds: EsportsFeed[]): EsportsGameId[] {
  return feeds
    .filter((feed) => feed.status === "ready" && !feed.partial && !feed.matches.length)
    .map((feed) => feed.game);
}
