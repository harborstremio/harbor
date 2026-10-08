import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings } from "@/lib/settings";
import { chooseGameArt, createTeamArtCache, teamArtCacheKey } from "@/lib/jl/sports/fanart";
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

/** TheSportsDB fan art for a game (home team first), or null to keep ESPN's look. */
export function useGameFanart(game: SportsGame | null): string | null {
  const { settings } = useSettings();
  const key = settings.thesportsdbKey.trim();
  useSyncExternalStore(teamArt.subscribe, teamArt.version, teamArt.version);
  const gameKey = game ? `${game.league}:${game.id}` : "";
  useEffect(() => {
    if (!key || !game) return;
    void teamArt.request(key, game.league, game.home);
    void teamArt.request(key, game.league, game.away);
    // The game identity and key decide the request; score updates don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gameKey]);
  if (!key || !game) return null;
  const home = teamArt.get(teamArtCacheKey(game.league, game.home)) ?? null;
  const away = teamArt.get(teamArtCacheKey(game.league, game.away)) ?? null;
  return chooseGameArt(game, home, away);
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
