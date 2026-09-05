import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import { LEAGUES, sortGames, type LeagueDef, type SportsGame, type SportsSide } from "@/lib/sports/espn";

export type FavouriteTeam = {
  id: string;
  leagueKey: string;
  group: string;
  name: string;
  abbr: string;
  logo: string;
};

export type SportsTeam = FavouriteTeam & { shortName: string };

export type SportsFavourites = {
  leagues: string[];
  teams: FavouriteTeam[];
  home: Record<string, string>;
};

export type TeamOutcome = "win" | "draw" | "loss";

export type TeamRef = { name: string; abbr: string };

const STORAGE_KEY = "harbor.sports.favourites.v1";
const BASE = "https://site.api.espn.com/apis/site/v2/sports";
const EMPTY: SportsFavourites = { leagues: [], teams: [], home: {} };

let cache: SportsFavourites = EMPTY;
let cacheJson = "";
const subs = new Set<() => void>();

function notify(): void {
  for (const fn of subs) fn();
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalise(raw: unknown): SportsFavourites {
  if (!raw || typeof raw !== "object") return EMPTY;
  const obj = raw as Record<string, unknown>;
  const leagues = (Array.isArray(obj.leagues) ? obj.leagues : []).filter(
    (k): k is string => typeof k === "string" && k.length > 0,
  );
  const teams: FavouriteTeam[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(obj.teams) ? obj.teams : []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = str(row.id);
    const leagueKey = str(row.leagueKey);
    if (!id || !leagueKey || seen.has(`${leagueKey}:${id}`)) continue;
    seen.add(`${leagueKey}:${id}`);
    const group = str(row.group) || groupOfLeague(leagueKey);
    teams.push({ id, leagueKey, group, name: str(row.name), abbr: str(row.abbr), logo: str(row.logo) });
  }
  const home: Record<string, string> = {};
  const rawHome = (obj.home ?? {}) as Record<string, unknown>;
  for (const [group, id] of Object.entries(rawHome)) {
    if (typeof id === "string" && id) home[group] = id;
  }
  return { leagues, teams, home };
}

export function readFavourites(): SportsFavourites {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw != null && raw !== cacheJson) {
      cache = normalise(JSON.parse(raw));
      cacheJson = raw;
    }
  } catch {
    return cache;
  }
  return cache;
}

export function writeFavourites(next: SportsFavourites): boolean {
  cache = next;
  cacheJson = JSON.stringify(next);
  let persisted = false;
  try {
    persisted = setItemWithRecovery(STORAGE_KEY, cacheJson);
  } catch (e) {
    console.warn("[sports-favourites] storage write failed", e);
  }
  notify();
  return persisted;
}

export function subscribeFavourites(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

readFavourites();

export function leagueOf(leagueKey: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.key === leagueKey);
}
export function groupOfLeague(leagueKey: string): string {
  return leagueOf(leagueKey)?.group ?? "";
}
export function isTeamFavourite(fav: SportsFavourites, leagueKey: string, teamId: string): boolean {
  return fav.teams.some((x) => x.id === teamId && x.leagueKey === leagueKey);
}
export function isLeagueFavourite(fav: SportsFavourites, leagueKey: string): boolean {
  return fav.leagues.includes(leagueKey);
}
export function isHomeTeam(fav: SportsFavourites, team: FavouriteTeam): boolean {
  return fav.home[team.group] === team.id;
}
export function teamsInLeague(fav: SportsFavourites, leagueKey: string): FavouriteTeam[] {
  return fav.teams.filter((x) => x.leagueKey === leagueKey);
}
export function orderedFavouriteTeams(fav: SportsFavourites): FavouriteTeam[] {
  return fav.teams.slice().sort((a, b) => {
    const ah = fav.home[a.group] === a.id ? 0 : 1;
    const bh = fav.home[b.group] === b.id ? 0 : 1;
    return ah - bh || a.group.localeCompare(b.group) || a.name.localeCompare(b.name);
  });
}

export function toggleFavouriteTeam(team: FavouriteTeam): boolean {
  const fav = readFavourites();
  const on = isTeamFavourite(fav, team.leagueKey, team.id);
  const teams = on
    ? fav.teams.filter((x) => !(x.id === team.id && x.leagueKey === team.leagueKey))
    : [...fav.teams, team];
  const home = { ...fav.home };
  if (on && home[team.group] === team.id) delete home[team.group];
  writeFavourites({ ...fav, teams, home });
  return !on;
}

export function setHomeTeam(team: FavouriteTeam): boolean {
  const fav = readFavourites();
  const already = fav.home[team.group] === team.id;
  const home = { ...fav.home };
  if (already) delete home[team.group];
  else home[team.group] = team.id;
  const teams = isTeamFavourite(fav, team.leagueKey, team.id) ? fav.teams : [...fav.teams, team];
  writeFavourites({ ...fav, teams, home });
  return !already;
}

export function toggleFavouriteLeague(leagueKey: string): boolean {
  const fav = readFavourites();
  const on = fav.leagues.includes(leagueKey);
  const leagues = on ? fav.leagues.filter((k) => k !== leagueKey) : [...fav.leagues, leagueKey];
  writeFavourites({ ...fav, leagues });
  return !on;
}

export function clearFavouriteTeams(leagueKey?: string): void {
  const fav = readFavourites();
  const teams = leagueKey ? fav.teams.filter((x) => x.leagueKey !== leagueKey) : [];
  const home: Record<string, string> = {};
  for (const [group, id] of Object.entries(fav.home)) {
    if (teams.some((x) => x.group === group && x.id === id)) home[group] = id;
  }
  writeFavourites({ ...fav, teams, home });
}

export function useFavourites(): SportsFavourites {
  return useSyncExternalStore(subscribeFavourites, () => cache, () => cache);
}

export function useFavouriteTeams(group?: string): FavouriteTeam[] {
  const fav = useFavourites();
  return useMemo(() => {
    const all = orderedFavouriteTeams(fav);
    return group ? all.filter((x) => x.group === group) : all;
  }, [fav, group]);
}

function sameSide(side: SportsSide, team: TeamRef): boolean {
  if (team.abbr && side.abbr && side.abbr.toUpperCase() === team.abbr.toUpperCase()) return true;
  return !!team.name && !!side.name && side.name.toLowerCase() === team.name.toLowerCase();
}

export function involvesTeam(game: SportsGame, team: TeamRef): boolean {
  return sameSide(game.home, team) || sameSide(game.away, team);
}

export function matchSides(game: SportsGame, team: TeamRef): { own: SportsSide; opponent: SportsSide; atHome: boolean } {
  return sameSide(game.home, team)
    ? { own: game.home, opponent: game.away, atHome: true }
    : { own: game.away, opponent: game.home, atHome: false };
}

export function outcomeFor(game: SportsGame, team: TeamRef): TeamOutcome | null {
  if (game.state !== "post") return null;
  const { own, opponent } = matchSides(game, team);
  if (own.winner) return "win";
  if (opponent.winner) return "loss";
  if (!own.score || !opponent.score) return null;
  const mine = Number(own.score);
  const theirs = Number(opponent.score);
  if (!Number.isFinite(mine) || !Number.isFinite(theirs)) return null;
  return mine === theirs ? "draw" : mine > theirs ? "win" : "loss";
}

export function nextFixture(games: SportsGame[]): SportsGame | null {
  const live = games.find((g) => g.state === "in");
  if (live) return live;
  return games.filter((g) => g.state === "pre").sort((a, b) => a.startMs - b.startMs)[0] ?? null;
}

export function lastResult(games: SportsGame[]): SportsGame | null {
  return games.filter((g) => g.state === "post").sort((a, b) => b.startMs - a.startMs)[0] ?? null;
}

export function recentForm(games: SportsGame[], team: TeamRef, size = 5): TeamOutcome[] {
  return games
    .filter((g) => g.state === "post")
    .sort((a, b) => b.startMs - a.startMs)
    .slice(0, size)
    .map((g) => outcomeFor(g, team))
    .filter((o): o is TeamOutcome => o !== null)
    .reverse();
}

export function mergeGames(base: SportsGame[], extra: SportsGame[]): SportsGame[] {
  const byId = new Map<string, SportsGame>();
  for (const g of base) byId.set(g.id, g);
  for (const g of extra) byId.set(g.id, g);
  return sortGames([...byId.values()]);
}

const TEAMS_TTL = 6 * 60 * 60 * 1000;
const SCHEDULE_TTL = 3 * 60 * 1000;
const teamsCache = new Map<string, { at: number; value: SportsTeam[] }>();
const teamsInflight = new Map<string, Promise<SportsTeam[]>>();
const scheduleCache = new Map<string, { at: number; value: SportsGame[] }>();
const scheduleInflight = new Map<string, Promise<SportsGame[]>>();

function throughCache<T>(
  store: Map<string, { at: number; value: T }>,
  inflight: Map<string, Promise<T>>,
  key: string,
  ttl: number,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = run()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch(() => store.get(key)?.value ?? fallback)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

function logoOf(team: Record<string, unknown>): string {
  if (typeof team.logo === "string") return team.logo;
  const logos = Array.isArray(team.logos) ? (team.logos as { href?: string }[]) : [];
  return logos[0]?.href ?? "";
}

async function fetchLeagueTeamsRaw(def: LeagueDef): Promise<SportsTeam[]> {
  const res = await safeFetch(`${BASE}/${def.path}/teams`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    sports?: { leagues?: { teams?: { team?: Record<string, unknown> }[] }[] }[];
  };
  const rows = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const out: SportsTeam[] = [];
  for (const row of rows) {
    const team = row?.team;
    if (!team) continue;
    const id = typeof team.id === "number" ? String(team.id) : str(team.id);
    const name = str(team.displayName) || str(team.name);
    if (!id || !name) continue;
    const shortName = str(team.shortDisplayName) || name;
    const abbr = str(team.abbreviation);
    out.push({ id, leagueKey: def.key, group: def.group, name, shortName, abbr, logo: logoOf(team) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function fetchLeagueTeams(leagueKey: string): Promise<SportsTeam[]> {
  const def = leagueOf(leagueKey);
  if (!def) return Promise.resolve([]);
  return throughCache(teamsCache, teamsInflight, leagueKey, TEAMS_TTL, () => fetchLeagueTeamsRaw(def), []);
}

function scoreOf(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  const obj = (raw ?? {}) as Record<string, unknown>;
  if (typeof obj.displayValue === "string") return obj.displayValue;
  return typeof obj.value === "number" ? String(obj.value) : "";
}

function sideOf(c: Record<string, unknown> | undefined): SportsSide {
  const team = (c?.team ?? {}) as Record<string, unknown>;
  const nested = (c?.score ?? {}) as Record<string, unknown>;
  return {
    id: str(team.id),
    name: str(team.displayName) || str(team.shortDisplayName) || str(team.name),
    abbr: str(team.abbreviation),
    logo: logoOf(team),
    score: scoreOf(c?.score),
    winner: c?.winner === true || nested.winner === true,
  };
}

function parseScheduleEvents(events: unknown[], def: LeagueDef): SportsGame[] {
  const out: SportsGame[] = [];
  for (const raw of events) {
    const ev = raw as Record<string, unknown>;
    const comps = Array.isArray(ev.competitions) ? (ev.competitions as Record<string, unknown>[]) : [];
    const comp = comps[0];
    if (!comp) continue;
    const cs = Array.isArray(comp.competitors) ? (comp.competitors as Record<string, unknown>[]) : [];
    const home = cs.find((c) => c.homeAway === "home") ?? cs[0];
    const away = cs.find((c) => c.homeAway === "away") ?? cs[1];
    const id = str(ev.id) || str(comp.id);
    if (!home || !away || !id) continue;
    const type = ((comp.status as Record<string, unknown> | undefined)?.type ?? {}) as Record<string, unknown>;
    const rawState = str(type.state);
    out.push({
      id,
      league: def.tag,
      state: rawState === "in" ? "in" : rawState === "post" ? "post" : "pre",
      detail: str(type.shortDetail) || str(type.detail) || str(type.description),
      home: sideOf(home),
      away: sideOf(away),
      startMs: Date.parse(str(ev.date) || str(comp.date)) || 0,
    });
  }
  return out;
}

async function fetchTeamScheduleRaw(def: LeagueDef, teamId: string): Promise<SportsGame[]> {
  const url = `${BASE}/${def.path}/teams/${teamId}/schedule`;
  const res = await safeFetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: unknown[] };
  const games = parseScheduleEvents(Array.isArray(data.events) ? data.events : [], def);
  if (games.length > 0) return games;
  const retry = await safeFetch(`${url}?season=${new Date().getFullYear()}`);
  if (!retry.ok) return [];
  const retryData = (await retry.json()) as { events?: unknown[] };
  return parseScheduleEvents(Array.isArray(retryData.events) ? retryData.events : [], def);
}

export function fetchTeamSchedule(leagueKey: string, teamId: string): Promise<SportsGame[]> {
  const def = leagueOf(leagueKey);
  if (!def || !teamId) return Promise.resolve([]);
  const key = `${leagueKey}:${teamId}`;
  return throughCache(scheduleCache, scheduleInflight, key, SCHEDULE_TTL, () => fetchTeamScheduleRaw(def, teamId), []);
}

export function useTeamSchedule(team: { leagueKey: string; id: string } | null, enabled = true) {
  const [games, setGames] = useState<SportsGame[]>([]);
  const [loading, setLoading] = useState(false);
  const leagueKey = team?.leagueKey ?? "";
  const teamId = team?.id ?? "";

  useEffect(() => {
    if (!enabled || !leagueKey || !teamId) {
      setGames([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTeamSchedule(leagueKey, teamId)
      .then((g) => !cancelled && setGames(sortGames(g)))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [enabled, leagueKey, teamId]);

  return { games, loading };
}
