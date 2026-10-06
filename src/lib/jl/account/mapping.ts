import type { JlFavoritePlayer } from "../sports/favorites.ts";
import type { JlFavoriteTeam } from "../sports/rank.ts";

/**
 * JL's `sports_favorites` rows use the web app's league keys ("cfb", "cbb"); the app uses
 * Harbor's league tags ("NCAAF", "NCAA"). Plain module, no I/O.
 */
const TO_JL: Record<string, string> = {
  NFL: "nfl",
  NCAAF: "cfb",
  NBA: "nba",
  NCAA: "cbb",
  NHL: "nhl",
  MLB: "mlb",
  EPL: "epl",
  UCL: "ucl",
  MLS: "mls",
  ESP: "laliga",
};
const FROM_JL: Record<string, string> = Object.fromEntries(Object.entries(TO_JL).map(([tag, key]) => [key, tag]));

export const jlLeagueKey = (tag: string): string | null => TO_JL[tag] ?? null;
export const harborLeagueTag = (key: string): string | null => FROM_JL[key] ?? null;

export type SportsFavoriteRow = {
  profile_id: string;
  kind: "team" | "athlete";
  league: string;
  espn_id: string;
  name: string;
};

const NAME_MAX = 120;

export function teamToRow(profileId: string, team: JlFavoriteTeam): SportsFavoriteRow | null {
  const league = jlLeagueKey(team.league);
  if (!league || !/^\d{1,12}$/.test(team.id)) return null;
  return { profile_id: profileId, kind: "team", league, espn_id: team.id, name: (team.name || team.id).slice(0, NAME_MAX) };
}

export function playerToRow(profileId: string, player: JlFavoritePlayer): SportsFavoriteRow | null {
  const league = jlLeagueKey(player.league);
  if (!league || !/^\d{1,12}$/.test(player.id)) return null;
  return {
    profile_id: profileId,
    kind: "athlete",
    league,
    espn_id: player.id,
    name: (player.name || player.id).slice(0, NAME_MAX),
  };
}

export const rowKey = (r: Pick<SportsFavoriteRow, "kind" | "league" | "espn_id">) => `${r.kind}:${r.league}:${r.espn_id}`;

/** Remote rows as app favorites. Players keep known team details; unknown players need a lookup. */
export function rowsToFavorites(
  rows: Array<Pick<SportsFavoriteRow, "kind" | "league" | "espn_id" | "name">>,
  knownPlayers: JlFavoritePlayer[],
): { teams: JlFavoriteTeam[]; players: JlFavoritePlayer[]; unresolved: JlFavoritePlayer[] } {
  const teams: JlFavoriteTeam[] = [];
  const players: JlFavoritePlayer[] = [];
  const unresolved: JlFavoritePlayer[] = [];
  for (const r of rows) {
    const league = harborLeagueTag(r.league);
    if (!league) continue;
    if (r.kind === "team") {
      teams.push({ league, id: r.espn_id, name: r.name });
      continue;
    }
    const known = knownPlayers.find((p) => p.league === league && p.id === r.espn_id);
    const player: JlFavoritePlayer = known ?? {
      league,
      id: r.espn_id,
      name: r.name,
      teamId: null,
      teamName: null,
      headshot: null,
      position: null,
    };
    players.push(player);
    if (!known) unresolved.push(player);
  }
  return { teams, players, unresolved };
}

/** Rows to add and remove so the remote set matches the local one. */
export function diffRows(
  local: SportsFavoriteRow[],
  remote: Array<Pick<SportsFavoriteRow, "kind" | "league" | "espn_id">>,
): { upsert: SportsFavoriteRow[]; remove: Array<Pick<SportsFavoriteRow, "kind" | "league" | "espn_id">> } {
  const remoteKeys = new Set(remote.map(rowKey));
  const localKeys = new Set(local.map(rowKey));
  return {
    upsert: local.filter((r) => !remoteKeys.has(rowKey(r))),
    remove: remote.filter((r) => !localKeys.has(rowKey(r))),
  };
}
