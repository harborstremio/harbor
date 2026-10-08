import type { JlFavoritePlayer } from "../sports/favorites.ts";
import type { JlFavoriteTeam } from "../sports/rank.ts";

/**
 * Followed teams and players as rows in the account's `media.favorites` table. The item id is the
 * app's league tag and ESPN id ("NFL:12"). Plain module, no I/O.
 */

export type FavoriteKind = "team" | "player";

export type MediaFavoriteRow = {
  profile_id: string;
  kind: FavoriteKind;
  item_id: string;
  meta: { name: string };
};

export type RemoteFavoriteRow = Pick<MediaFavoriteRow, "kind" | "item_id" | "meta">;

const NAME_MAX = 120;
const LEAGUE_RX = /^[A-Za-z0-9.-]{1,16}$/;
const ID_RX = /^[A-Za-z0-9_-]{1,32}$/;

function itemId(league: string, id: string): string | null {
  return LEAGUE_RX.test(league) && ID_RX.test(id) ? `${league}:${id}` : null;
}

function splitItemId(item: string): { league: string; id: string } | null {
  const at = item.indexOf(":");
  if (at <= 0) return null;
  const league = item.slice(0, at);
  const id = item.slice(at + 1);
  return LEAGUE_RX.test(league) && ID_RX.test(id) ? { league, id } : null;
}

export function teamToRow(profileId: string, team: JlFavoriteTeam): MediaFavoriteRow | null {
  const item = itemId(team.league, team.id);
  if (!item) return null;
  return { profile_id: profileId, kind: "team", item_id: item, meta: { name: (team.name || team.id).slice(0, NAME_MAX) } };
}

export function playerToRow(profileId: string, player: JlFavoritePlayer): MediaFavoriteRow | null {
  const item = itemId(player.league, player.id);
  if (!item) return null;
  return {
    profile_id: profileId,
    kind: "player",
    item_id: item,
    meta: { name: (player.name || player.id).slice(0, NAME_MAX) },
  };
}

export const rowKey = (r: Pick<MediaFavoriteRow, "kind" | "item_id">) => `${r.kind}:${r.item_id}`;

/** Remote rows as app favorites. Players keep known team details; unknown players need a lookup. */
export function rowsToFavorites(
  rows: RemoteFavoriteRow[],
  knownPlayers: JlFavoritePlayer[],
): { teams: JlFavoriteTeam[]; players: JlFavoritePlayer[]; unresolved: JlFavoritePlayer[] } {
  const teams: JlFavoriteTeam[] = [];
  const players: JlFavoritePlayer[] = [];
  const unresolved: JlFavoritePlayer[] = [];
  for (const r of rows) {
    const parsed = splitItemId(r.item_id);
    if (!parsed) continue;
    const name = typeof r.meta?.name === "string" ? r.meta.name : parsed.id;
    if (r.kind === "team") {
      teams.push({ league: parsed.league, id: parsed.id, name });
      continue;
    }
    if (r.kind !== "player") continue;
    const known = knownPlayers.find((p) => p.league === parsed.league && p.id === parsed.id);
    const player: JlFavoritePlayer = known ?? {
      league: parsed.league,
      id: parsed.id,
      name,
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
  local: MediaFavoriteRow[],
  remote: Array<Pick<MediaFavoriteRow, "kind" | "item_id">>,
): { upsert: MediaFavoriteRow[]; remove: Array<Pick<MediaFavoriteRow, "kind" | "item_id">> } {
  const remoteKeys = new Set(remote.map(rowKey));
  const localKeys = new Set(local.map(rowKey));
  return {
    upsert: local.filter((r) => !remoteKeys.has(rowKey(r))),
    remove: remote.filter((r) => !localKeys.has(rowKey(r))),
  };
}
