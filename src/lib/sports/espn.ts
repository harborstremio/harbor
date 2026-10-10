import type { LeagueDef as EspnLeagueDef, SportsGame as EspnSportsGame } from "./espn-types";
import { leagueByKey, leagueByTag } from "./espn-leagues";
import { parseEvents } from "./espn-parse";

export type {
  EventContext,
  LeagueDef,
  LeagueGroupDef,
  MatchEvent,
  MatchPlayer,
  MatchTeamStatRow,
  MatchTeamStats,
  MMAFighterProfile,
  SportsGame,
  SportsMatchDetail,
  SportsSide,
} from "./espn-types";
export {
  DEFAULT_SPORTS_LEAGUES,
  LEAGUES,
  LEAGUE_GROUPS,
  getGroupLabel,
  getLeagueLabel,
} from "./espn-leagues";
export { fetchSports, liveCount, sortGames } from "./espn-scoreboard";
export { fetchMatchSummary } from "./espn-summary";

// Games carry the league tag ("NCAA" for college basketball), settings the key ("NCAAB"); both are unique.
function leagueDef(keyOrTag: string): EspnLeagueDef | undefined {
  return leagueByKey(keyOrTag) ?? leagueByTag(keyOrTag);
}

/** Scoreboard-shaped ESPN events for a league key or tag, as games. Empty for an unknown league. */
export function parseLeagueEvents(events: unknown[], league: string): EspnSportsGame[] {
  const def = leagueDef(league);
  return def ? parseEvents(events, def) : [];
}

/** The ESPN site API path for a league key or tag ("football/college-football"). */
export function leaguePath(league: string): string | null {
  return leagueDef(league)?.path ?? null;
}
