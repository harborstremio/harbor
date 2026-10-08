import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { teamKey } from "./event-parse.ts";
import { isPathSafeKey, THESPORTSDB_BASE } from "./sports-keys.ts";

/**
 * Team fan art from TheSportsDB (the viewer's own key). Teams are matched to ESPN's by the
 * idESPN field TheSportsDB stores, then by name within the same sport, so "Warriors" never
 * picks the wrong Warriors. Answers are cached per team (memory + storage) and requests are
 * spaced out to stay inside the free plan's per-minute limit.
 */

export type TeamArt = { fanart: string[]; banner: string | null };

/** TheSportsDB's strSport for each JL league key. */
const SPORT_BY_LEAGUE: Record<string, string> = {
  NFL: "American Football",
  NCAAF: "American Football",
  NBA: "Basketball",
  NCAAB: "Basketball",
  NHL: "Ice Hockey",
  MLB: "Baseball",
  UFC: "Fighting",
  F1: "Motorsport",
  NASCAR: "Motorsport",
  TENNIS: "Tennis",
  PGA: "Golf",
  RUGBY: "Rugby",
};

export function sportForLeague(league: string): string {
  return SPORT_BY_LEAGUE[league] ?? "Soccer";
}

const https = (u: unknown): string | null =>
  typeof u === "string" && /^https?:\/\//.test(u) ? u.replace(/^http:\/\//, "https://") : null;

type TsdbTeam = Record<string, unknown>;

/** Picks the right TheSportsDB team for an ESPN side and maps its artwork. */
export function pickTeamArt(teams: unknown, side: Pick<SportsSide, "id" | "name">, league: string): TeamArt | null {
  if (!Array.isArray(teams)) return null;
  const list = teams.filter((t): t is TsdbTeam => !!t && typeof t === "object");
  const sport = sportForLeague(league).toLowerCase();
  const sameSport = (t: TsdbTeam) => typeof t.strSport === "string" && t.strSport.toLowerCase() === sport;
  const wanted = teamKey(side.name);
  const team =
    (side.id ? list.find((t) => sameSport(t) && String(t.idESPN ?? "") === side.id) : undefined) ??
    list.find((t) => sameSport(t) && typeof t.strTeam === "string" && teamKey(t.strTeam) === wanted) ??
    list.find(
      (t) =>
        sameSport(t) &&
        typeof t.strTeamAlternate === "string" &&
        t.strTeamAlternate.split(",").some((alt) => teamKey(alt) === wanted),
    );
  if (!team) return null;
  const fanart = [team.strFanart1, team.strFanart2, team.strFanart3, team.strFanart4]
    .map(https)
    .filter((u): u is string => !!u);
  const banner = https(team.strBanner);
  if (!fanart.length && !banner) return null;
  return { fanart, banner };
}

/** A stable small hash, so the same game always shows the same of a team's wallpapers. */
export function stableIndex(seed: string, size: number): number {
  if (size <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % size;
}

/** The background for a game: the home team's fan art, then the away team's, then a banner. */
export function chooseGameArt(game: Pick<SportsGame, "id">, home: TeamArt | null, away: TeamArt | null): string | null {
  for (const art of [home, away]) {
    if (art?.fanart.length) return art.fanart[stableIndex(game.id, art.fanart.length)];
  }
  return home?.banner ?? away?.banner ?? null;
}

export function teamSearchUrl(key: string, name: string): string | null {
  if (!isPathSafeKey(key) || !name.trim()) return null;
  return `${THESPORTSDB_BASE}/${key}/searchteams.php?t=${encodeURIComponent(name.trim())}`;
}

export function teamArtCacheKey(league: string, side: Pick<SportsSide, "id" | "name">): string {
  return `${league}:${side.id || teamKey(side.name)}`;
}

/* ---------------- Cache with expiry ---------------- */

export const ART_HIT_TTL_MS = 7 * 24 * 3600_000;
export const ART_MISS_TTL_MS = 24 * 3600_000;
export const RETRY_TTL_MS = 10 * 60_000;
const MAX_STORED = 400;

export type ArtCacheEntry = { art: TeamArt | null; expires: number };
export type ArtCacheRecord = Record<string, ArtCacheEntry>;

/** Reads the stored cache, dropping expired and malformed entries. */
export function parseArtCache(raw: string | null, now: number): ArtCacheRecord {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: ArtCacheRecord = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const e = v as Partial<ArtCacheEntry> | null;
    if (!e || typeof e.expires !== "number" || e.expires <= now) continue;
    if (e.art === null) out[k] = { art: null, expires: e.expires };
    else if (e.art && Array.isArray(e.art.fanart)) {
      const fanart = e.art.fanart.filter((u): u is string => typeof u === "string");
      const banner = typeof e.art.banner === "string" ? e.art.banner : null;
      out[k] = { art: { fanart, banner }, expires: e.expires };
    }
  }
  return out;
}

/** Keeps the newest entries when the stored cache grows past its cap. */
export function trimArtCache(record: ArtCacheRecord, max = MAX_STORED): ArtCacheRecord {
  const entries = Object.entries(record);
  if (entries.length <= max) return record;
  entries.sort((a, b) => b[1].expires - a[1].expires);
  return Object.fromEntries(entries.slice(0, max));
}

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };
type FetchJson = (url: string) => Promise<{ status: number; json: unknown }>;

export type TeamArtCacheDeps = {
  fetchJson: FetchJson;
  storage: StorageLike | null;
  now?: () => number;
  /** Waits between requests; injected so tests don't sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Spacing between TheSportsDB requests (the free plan allows about 30 a minute). */
  spacingMs?: number;
  storageKey?: string;
};

/**
 * One cache per app: `get` answers from memory/storage at once, `load` queues a request
 * when nothing fresh is cached, and `subscribe` tells views when an answer lands.
 */
export function createTeamArtCache(deps: TeamArtCacheDeps) {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const spacing = deps.spacingMs ?? 2100;
  const storageKey = deps.storageKey ?? "jl.sports.teamArt.v1";
  let record: ArtCacheRecord | null = null;
  const inflight = new Map<string, Promise<TeamArt | null>>();
  const listeners = new Set<() => void>();
  let chain: Promise<void> = Promise.resolve();
  let lastStart = -Infinity;
  let version = 0;

  const load = (): ArtCacheRecord => {
    if (record) return record;
    let raw: string | null = null;
    try {
      raw = deps.storage?.getItem(storageKey) ?? null;
    } catch {
      raw = null;
    }
    record = parseArtCache(raw, now());
    return record;
  };

  const persist = () => {
    if (!record || !deps.storage) return;
    record = trimArtCache(record);
    try {
      deps.storage.setItem(storageKey, JSON.stringify(record));
    } catch {
      /* storage full or blocked: the memory copy still works */
    }
  };

  const notify = () => {
    version++;
    for (const fn of listeners) fn();
  };

  /** Cached art: undefined = not known yet, null = known to have none. */
  const get = (cacheKey: string): TeamArt | null | undefined => {
    const e = load()[cacheKey];
    if (!e) return undefined;
    if (e.expires <= now()) return undefined;
    return e.art;
  };

  const request = (key: string, league: string, side: Pick<SportsSide, "id" | "name">): Promise<TeamArt | null> => {
    const cacheKey = teamArtCacheKey(league, side);
    const cached = get(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached);
    const running = inflight.get(cacheKey);
    if (running) return running;
    const url = teamSearchUrl(key, side.name);
    if (!url) return Promise.resolve(null);
    const job = new Promise<TeamArt | null>((resolve) => {
      chain = chain.then(async () => {
        const wait = lastStart + spacing - now();
        if (wait > 0) await sleep(wait);
        lastStart = now();
        let art: TeamArt | null = null;
        let ttl = ART_MISS_TTL_MS;
        try {
          const res = await deps.fetchJson(url);
          if (res.status === 200) {
            art = pickTeamArt((res.json as { teams?: unknown } | null)?.teams, side, league);
            if (art) ttl = ART_HIT_TTL_MS;
          } else {
            // Busy, offline or a key problem: try again in a while rather than remembering "no art".
            ttl = RETRY_TTL_MS;
          }
        } catch {
          ttl = RETRY_TTL_MS;
        }
        load()[cacheKey] = { art, expires: now() + ttl };
        persist();
        inflight.delete(cacheKey);
        notify();
        resolve(art);
      });
    });
    inflight.set(cacheKey, job);
    return job;
  };

  return {
    get,
    request,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    version: () => version,
  };
}

export type TeamArtCache = ReturnType<typeof createTeamArtCache>;
