import { useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import type { JlFavoriteTeam } from "./rank";

/** A followed player. Following a player also follows their team for Game Day. */
export type JlFavoritePlayer = {
  league: string;
  id: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  headshot: string | null;
  position: string | null;
};

type ListStore<T> = {
  useList: () => T[];
  read: () => T[];
  write: (list: T[], requirePersistence?: boolean) => void;
};

// Told about every write to either list (the account sync pushes changes from here).
const changeListeners = new Set<() => void>();

export function subscribeJlFavoriteChanges(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => {
    changeListeners.delete(fn);
  };
}

function createProfileListStore<T>(
  baseKey: string,
  valid: (item: unknown) => item is T,
): ListStore<T> {
  const empty: T[] = [];
  const listeners = new Set<() => void>();
  let cache: { key: string; raw: string | null; list: T[] } | null = null;
  const keyFor = () => `${baseKey}.${activeProfileId()}`;

  const read = (): T[] => {
    const key = keyFor();
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    if (cache && cache.key === key && cache.raw === raw) return cache.list;
    let list = empty;
    try {
      const value = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(value)) list = value.filter(valid);
    } catch {
      list = empty;
    }
    cache = { key, raw, list };
    return list;
  };

  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const write = (list: T[], requirePersistence = false) => {
    try {
      localStorage.setItem(keyFor(), JSON.stringify(list));
    } catch (error) {
      if (requirePersistence) throw error;
      /* storage unavailable: nothing can be saved */
    }
    for (const fn of listeners) fn();
    for (const fn of changeListeners) fn();
  };

  if (typeof window !== "undefined") {
    const refresh = () => {
      cache = null;
      for (const fn of listeners) fn();
    };
    window.addEventListener("harbor:active-profile-changed", refresh);
    window.addEventListener("jl:account-changed", refresh);
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key.startsWith(baseKey + ".")) refresh();
    });
  }

  return { read, write, useList: () => useSyncExternalStore(subscribe, read, () => empty) };
}

const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === "string";

const teams = createProfileListStore<JlFavoriteTeam>(
  "jl.sports.favorites.v1",
  (f): f is JlFavoriteTeam => {
    const r = f as Record<string, unknown> | null;
    return !!r && isString(r.league) && isString(r.id) && isString(r.name);
  },
);

const players = createProfileListStore<JlFavoritePlayer>(
  "jl.sports.players.v1",
  (f): f is JlFavoritePlayer => {
    const r = f as Record<string, unknown> | null;
    return (
      !!r &&
      isString(r.league) &&
      isString(r.id) &&
      isString(r.name) &&
      isNullableString(r.teamId) &&
      isNullableString(r.teamName) &&
      isNullableString(r.headshot) &&
      isNullableString(r.position)
    );
  },
);

export function isFollowing(
  list: Array<{ league: string; id: string }>,
  league: string,
  id: string,
): boolean {
  return list.some((f) => f.league === league && f.id === id);
}

function toggle<T extends { league: string; id: string }>(store: ListStore<T>, item: T): void {
  if (!item.id) return;
  const list = store.read();
  store.write(
    isFollowing(list, item.league, item.id)
      ? list.filter((f) => !(f.league === item.league && f.id === item.id))
      : [...list, item],
  );
}

export const toggleFavoriteTeam = (team: JlFavoriteTeam) => toggle(teams, team);
export const toggleFavoritePlayer = (player: JlFavoritePlayer) => toggle(players, player);
export const useJlSportsFavorites = teams.useList;
export const useJlFavoritePlayers = players.useList;
export const readJlFavorites = () => ({ teams: teams.read(), players: players.read() });
export const writeJlFavorites = (
  next: { teams?: JlFavoriteTeam[]; players?: JlFavoritePlayer[] },
  requirePersistence = false,
) => {
  if (next.teams) teams.write(next.teams, requirePersistence);
  if (next.players) players.write(next.players, requirePersistence);
};

/** Teams to rank and fetch for: followed teams plus followed players' teams. */
export function effectiveTeams(
  teamList: JlFavoriteTeam[],
  playerList: JlFavoritePlayer[],
): JlFavoriteTeam[] {
  const out = [...teamList];
  for (const p of playerList) {
    if (!p.teamId || isFollowing(out, p.league, p.teamId)) continue;
    out.push({ league: p.league, id: p.teamId, name: p.teamName ?? "" });
  }
  return out;
}
