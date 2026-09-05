import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef, SportsGame } from "./espn-types";
import { LEAGUES, SITE_BASE, leagueByKey } from "./espn-leagues";
import { parseEvents } from "./espn-parse";

const TTL = 10_000;
const DATED_TTL = 120_000;
const FETCH_CONCURRENCY = 8;
const CACHE_DAYS = 3;
const CACHE_CAP = LEAGUES.length * CACHE_DAYS + 64;

type CacheEntry = { at: number; games: SportsGame[] };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SportsGame[]>>();

function cacheGet(key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
  for (const oldest of cache.keys()) {
    if (cache.size <= CACHE_CAP) break;
    cache.delete(oldest);
  }
}

export function localStamp(d: Date): string {
  return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, "0")}${`${d.getDate()}`.padStart(2, "0")}`;
}

async function fetchScoreboardEvents(def: LeagueDef, dateStr: string): Promise<unknown[]> {
  const r = await safeFetch(`${SITE_BASE}/${def.path}/scoreboard?dates=${dateStr}`);
  if (!r.ok) return [];
  const d = (await r.json()) as { events?: unknown[] };
  return Array.isArray(d.events) ? d.events : [];
}

function pastCalendarDates(rawCalendar: unknown[], nowMs: number): number[] {
  const pastDates: number[] = [];
  for (const entry of rawCalendar) {
    if (typeof entry === "string") {
      const ms = Date.parse(entry);
      if (!isNaN(ms) && ms < nowMs) pastDates.push(ms);
    } else if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const end = typeof obj.endDate === "string" ? Date.parse(obj.endDate) : NaN;
      const start = typeof obj.startDate === "string" ? Date.parse(obj.startDate) : NaN;
      const ref = !isNaN(end) ? end : !isNaN(start) ? start : NaN;
      if (!isNaN(ref) && ref < nowMs) pastDates.push(ref);
    }
  }
  return pastDates.sort((a, b) => b - a);
}

async function fetchLeagueRaw(league: string, dates?: string): Promise<SportsGame[]> {
  const def = leagueByKey(league);
  if (!def) return [];
  const res = await safeFetch(`${SITE_BASE}/${def.path}/scoreboard${dates ? `?dates=${dates}` : ""}`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    events?: unknown[];
    leagues?: { calendar?: unknown[] }[];
  };
  const events = Array.isArray(data.events) ? data.events : [];

  if (events.length > 0) {
    return parseEvents(events, def);
  }

  if (dates) return [];

  if (def.group === "tennis") return [];

  const pastDates = pastCalendarDates(data.leagues?.[0]?.calendar ?? [], Date.now());
  const candidates = pastDates.filter((_, i) => i === 0 || i % 3 === 0).slice(0, 10);

  for (const ms of candidates) {
    const dateStr = new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
    try {
      const evs = await fetchScoreboardEvents(def, dateStr);
      if (evs.length > 0) return parseEvents(evs, def);
    } catch {}
  }

  return fetchLeagueLastResults(def);
}

async function fetchLeagueLastResults(def: LeagueDef): Promise<SportsGame[]> {
  const now = new Date();
  for (let daysBack = 1; daysBack <= 60; daysBack++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    try {
      const evs = await fetchScoreboardEvents(def, dateStr);
      if (evs.length > 0) return parseEvents(evs, def);
    } catch {}
  }
  return [];
}

function fetchLeague(league: string, dates?: string): Promise<SportsGame[]> {
  const key = dates ? `${league}@${dates}` : league;
  const ttl = dates && dates !== localStamp(new Date()) ? DATED_TTL : TTL;
  const cached = cacheGet(key);
  if (cached && Date.now() - cached.at < ttl) return Promise.resolve(cached.games);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetchLeagueRaw(league, dates)
    .then((games) => {
      cacheSet(key, { at: Date.now(), games });
      return games;
    })
    .catch(() => cache.get(key)?.games ?? [])
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function pooled(
  leagues: string[],
  dates: string | undefined,
  limit: number,
): Promise<SportsGame[][]> {
  const out: SportsGame[][] = new Array(leagues.length);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= leagues.length) return;
      out[i] = await fetchLeague(leagues[i], dates).catch(() => [] as SportsGame[]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, leagues.length) }, worker));
  return out;
}

function rank(s: SportsGame["state"]): number {
  return s === "in" ? 0 : s === "pre" ? 1 : 2;
}

export function sortGames(games: SportsGame[]): SportsGame[] {
  return games
    .slice()
    .sort((a, b) => rank(a.state) - rank(b.state) || (a.state === "post" ? b.startMs - a.startMs : a.startMs - b.startMs));
}

export function liveCount(games: SportsGame[]): number {
  return games.filter((g) => g.state === "in").length;
}

export async function fetchSports(leagues: string[], dates?: string): Promise<SportsGame[]> {
  const lists = await pooled(leagues, dates, FETCH_CONCURRENCY);
  return sortGames(lists.flat());
}
