import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings } from "@/lib/settings";
import {
  chooseGameArt,
  createTeamArtCache,
  teamArtCacheKey,
  type ArtSide,
  type TeamArt,
} from "@/lib/jl/sports/fanart";
import { artKey, curatedArt } from "@/lib/jl/sports/curated-art";
import {
  applyOddsLines,
  oddsLeaguesFor,
  oddsSportKey,
  oddsUrl,
  ODDS_TTL_MS,
  parseOddsCache,
  parseOddsEvents,
  type OddsCacheEntry,
  type OddsLine,
} from "@/lib/jl/sports/odds-api";
import type { SportsGame } from "@/lib/sports/espn";

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<{ status: number; json: unknown }> {
  const res = await safeFetch(url);
  const json = res.ok ? await res.json().catch(() => null) : null;
  return { status: res.status, json };
}

const teamArt = createTeamArtCache({ fetchJson, storage: browserStorage() });

type ArtTeam = { league: string; side: ArtSide };

function useArtKey(): string {
  const { settings } = useSettings();
  return settings.thesportsdbKey.trim();
}

/**
 * Asks TheSportsDB for every team on the page at once (one team list per league, then a search
 * for any team the list lacks), so art doesn't depend on which card happens to be on screen.
 */
export function usePrefetchTeamArt(games: SportsGame[], extra: ArtTeam[] = []): void {
  const key = useArtKey();
  const teams: ArtTeam[] = [];
  for (const g of games)
    teams.push({ league: g.league, side: g.home }, { league: g.league, side: g.away });
  teams.push(...extra);
  const wanted = teams.filter((t) => t.side.name);
  const teamsKey = wanted.map((t) => teamArtCacheKey(t.league, t.side)).join(",");
  useEffect(() => {
    if (!key) return;
    for (const t of wanted) void teamArt.request(key, t.league, t.side);
    // teamsKey captures the team list; live score updates don't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, teamsKey]);
}

/** A team's TheSportsDB art once known (null without a key or art). */
export function useTeamArt(league: string, side: ArtSide | null): TeamArt | null {
  const key = useArtKey();
  useSyncExternalStore(teamArt.subscribe, teamArt.version, teamArt.version);
  const cacheKey = side ? teamArtCacheKey(league, side) : "";
  useEffect(() => {
    if (!key || !side) return;
    void teamArt.request(key, league, side);
    // The team identity and key decide the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cacheKey]);
  if (!key || !side) return null;
  return teamArt.get(cacheKey) ?? null;
}

export type GameArt = { photo: string | null; home: TeamArt | null; away: TeamArt | null };

/** A team's own curated wallpaper, when one is set. */
export function curatedTeamArt(league: string, side: { id?: string } | null): string | null {
  return side?.id ? curatedArt(artKey.team(league, side.id)) : null;
}

/**
 * Art for a game: curated art (home team first), then TheSportsDB's photo; null leaves the
 * designed backdrop. Each team's TheSportsDB art comes along for colours and badges.
 */
export function useGameArt(game: SportsGame | null): GameArt {
  const league = game?.league ?? "";
  const home = useTeamArt(league, game?.home ?? null);
  const away = useTeamArt(league, game?.away ?? null);
  const curated = game
    ? (curatedTeamArt(league, game.home) ?? curatedTeamArt(league, game.away))
    : null;
  return { photo: curated ?? (game ? chooseGameArt(game, home, away) : null), home, away };
}

/* ---------------- The Odds API ---------------- */

const ODDS_STORAGE_KEY = "jl.sports.oddsLines.v1";
let oddsRecord: Record<string, OddsCacheEntry> | null = null;
const oddsInflight = new Map<string, Promise<void>>();
const oddsListeners = new Set<() => void>();

function oddsCache(): Record<string, OddsCacheEntry> {
  if (!oddsRecord) {
    let raw: string | null = null;
    try {
      raw = browserStorage()?.getItem(ODDS_STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    oddsRecord = parseOddsCache(raw, Date.now());
  }
  return oddsRecord;
}

function setOddsLines(league: string, lines: OddsLine[], ttl: number) {
  // A new object per update, so subscribers see the change.
  oddsRecord = { ...oddsCache(), [league]: { lines, expires: Date.now() + ttl } };
  try {
    browserStorage()?.setItem(ODDS_STORAGE_KEY, JSON.stringify(oddsRecord));
  } catch {
    /* the memory copy still works */
  }
  for (const fn of oddsListeners) fn();
}

function requestOdds(key: string, league: string): void {
  const sport = oddsSportKey(league);
  if (!sport) return;
  const cached = oddsCache()[league];
  if (cached && cached.expires > Date.now()) return;
  if (oddsInflight.has(league)) return;
  const job = fetchJson(oddsUrl(key, sport))
    .then(({ status, json }) => {
      // A rejected key or a used-up quota waits an hour instead of asking again every poll.
      if (status === 200) setOddsLines(league, parseOddsEvents(json), ODDS_TTL_MS);
      else setOddsLines(league, [], status === 401 || status === 429 ? ODDS_TTL_MS : 3600_000);
    })
    .catch(() => setOddsLines(league, [], 15 * 60_000))
    .finally(() => oddsInflight.delete(league));
  oddsInflight.set(league, job);
}

function subscribeOdds(fn: () => void) {
  oddsListeners.add(fn);
  return () => {
    oddsListeners.delete(fn);
  };
}

/**
 * Replaces each game's ESPN odds with The Odds API's moneyline and spread when the viewer
 * has a key; games The Odds API doesn't list keep ESPN's line.
 */
export function useOddsApiGames(games: SportsGame[]): SportsGame[] {
  const { settings } = useSettings();
  const key = settings.oddsApiKey.trim();
  const record = useSyncExternalStore(subscribeOdds, oddsCache, oddsCache);
  const leagues = useMemo(() => (key ? oddsLeaguesFor(games) : []), [games, key]);
  const leaguesKey = leagues.join(",");
  // Re-check expiry while the page stays open.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!key) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 15 * 60_000);
    return () => window.clearInterval(id);
  }, [key]);
  useEffect(() => {
    if (!key) return;
    for (const league of leagues) requestOdds(key, league);
    // leaguesKey captures the league list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, leaguesKey, tick]);
  return useMemo(() => {
    if (!key) return games;
    const byLeague: Record<string, OddsLine[] | undefined> = {};
    for (const league of leagues) byLeague[league] = record[league]?.lines;
    return applyOddsLines(games, byLeague);
  }, [games, key, leagues, record]);
}
