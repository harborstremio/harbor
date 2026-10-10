import type { SportsGame, SportsSide } from "../../sports/espn.ts";
import { teamKey } from "./event-parse.ts";
import { isPathSafeKey, THESPORTSDB_BASE } from "./sports-keys.ts";

/**
 * Team artwork from TheSportsDB (the viewer's own key). A league's whole team list is fetched in
 * one request where TheSportsDB has the league, so a page of games costs one call per league
 * instead of one per team; teams the list doesn't have fall back to a name search. Teams are
 * matched to ESPN's by the idESPN field TheSportsDB stores, then by name variants within the same
 * sport, so "Warriors" never picks the wrong Warriors. Answers are cached per team (memory +
 * storage) and requests are spaced out to stay inside the free plan's per-minute limit.
 */

export type TeamArt = {
  /** Wallpapers (strFanart1-4). */
  fanart: string[];
  /** Wide wordmark strip. */
  banner: string | null;
  /** Stadium photo. */
  stadium: string | null;
  /** Crest / badge. */
  badge: string | null;
  /** Team colours from TheSportsDB, hex without '#'. */
  colors: string[];
};

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

/** TheSportsDB league ids, for one team-list request per league. */
export const TSDB_LEAGUE_IDS: Record<string, string> = {
  NFL: "4391",
  NBA: "4387",
  NHL: "4380",
  MLB: "4424",
  MLS: "4346",
  EPL: "4328",
  UCL: "4480",
  NCAAF: "4479",
  NCAAB: "4607",
};

export function sportForLeague(league: string): string {
  return SPORT_BY_LEAGUE[league] ?? "Soccer";
}

const https = (u: unknown): string | null =>
  typeof u === "string" && /^https?:\/\//.test(u) ? u.replace(/^http:\/\//, "https://") : null;

const hexOf = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? m[1].toLowerCase() : null;
};

type TsdbTeam = Record<string, unknown>;

/** The side as the matcher sees it: ESPN's id, full name and, when known, school/city and mascot. */
export type ArtSide = Pick<SportsSide, "id" | "name" | "location" | "nickname" | "abbr">;

/** A looser key: "Miami (FL) Hurricanes" = "Miami Hurricanes". */
const looseKey = (name: string) =>
  teamKey(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function teamNames(t: TsdbTeam): string[] {
  const out: string[] = [];
  if (typeof t.strTeam === "string") out.push(t.strTeam);
  if (typeof t.strTeamAlternate === "string") out.push(...t.strTeamAlternate.split(","));
  return out.map((n) => n.trim()).filter(Boolean);
}

/** Finds the TheSportsDB team for an ESPN side among `teams` (search results or a league list). */
export function matchTsdbTeam(teams: unknown, side: ArtSide, league: string): TsdbTeam | null {
  if (!Array.isArray(teams)) return null;
  const sport = sportForLeague(league).toLowerCase();
  const list = teams.filter(
    (t): t is TsdbTeam =>
      !!t &&
      typeof t === "object" &&
      typeof (t as TsdbTeam).strSport === "string" &&
      String((t as TsdbTeam).strSport).toLowerCase() === sport,
  );
  if (!list.length) return null;
  if (side.id) {
    const byId = list.find((t) => String(t.idESPN ?? "") === side.id);
    if (byId) return byId;
  }
  const wanted = [
    side.name,
    side.location && side.nickname ? `${side.location} ${side.nickname}` : "",
  ].filter((n): n is string => !!n && !!n.trim());
  for (const keyFn of [teamKey, looseKey]) {
    const keys = new Set(wanted.map(keyFn));
    const hit = list.find((t) => teamNames(t).some((n) => keys.has(keyFn(n))));
    if (hit) return hit;
  }
  // School or city alone ("Stanford"), or the abbreviation, only when exactly one team answers.
  const unique = (pred: (t: TsdbTeam) => boolean) => {
    const found = list.filter(pred);
    return found.length === 1 ? found[0] : null;
  };
  if (side.location) {
    const loc = looseKey(side.location);
    const hit = unique((t) => teamNames(t).some((n) => looseKey(n) === loc));
    if (hit) return hit;
    // "Stanford" + "Cardinal": a listed name that starts with the school and ends with the mascot.
    if (side.nickname) {
      const nick = looseKey(side.nickname);
      const both = unique((t) =>
        teamNames(t).some((n) => {
          const k = looseKey(n);
          return k.startsWith(`${loc} `) && k.endsWith(` ${nick}`);
        }),
      );
      if (both) return both;
    }
  }
  if (side.abbr && side.abbr.length >= 2) {
    const abbr = side.abbr.toUpperCase();
    const hit = unique(
      (t) => typeof t.strTeamShort === "string" && t.strTeamShort.toUpperCase() === abbr,
    );
    if (hit) return hit;
  }
  return null;
}

/** The artwork a TheSportsDB team carries, or null when it has none at all. */
export function teamArtOf(team: TsdbTeam): TeamArt | null {
  const fanart = [team.strFanart1, team.strFanart2, team.strFanart3, team.strFanart4]
    .map(https)
    .filter((u): u is string => !!u);
  const art: TeamArt = {
    fanart,
    banner: https(team.strBanner),
    stadium: https(team.strStadiumThumb),
    badge: https(team.strBadge) ?? https(team.strTeamBadge) ?? https(team.strLogo),
    colors: [team.strColour1, team.strColour2, team.strColour3]
      .map(hexOf)
      .filter((c): c is string => !!c),
  };
  if (!fanart.length && !art.banner && !art.stadium && !art.badge && !art.colors.length)
    return null;
  return art;
}

/** Picks the right TheSportsDB team for an ESPN side and maps its artwork. */
export function pickTeamArt(teams: unknown, side: ArtSide, league: string): TeamArt | null {
  const team = matchTsdbTeam(teams, side, league);
  return team ? teamArtOf(team) : null;
}

/** A stable small hash, so the same game always shows the same of a team's wallpapers. */
export function stableIndex(seed: string, size: number): number {
  if (size <= 0) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % size;
}

/** The photo behind a game: fan art (home team first), then a stadium, then a banner. */
export function chooseGameArt(
  game: Pick<SportsGame, "id">,
  home: TeamArt | null,
  away: TeamArt | null,
): string | null {
  for (const art of [home, away]) {
    if (art?.fanart.length) return art.fanart[stableIndex(game.id, art.fanart.length)];
  }
  return home?.stadium ?? away?.stadium ?? home?.banner ?? away?.banner ?? null;
}

export function teamSearchUrl(key: string, name: string): string | null {
  if (!isPathSafeKey(key) || !name.trim()) return null;
  return `${THESPORTSDB_BASE}/${key}/searchteams.php?t=${encodeURIComponent(name.trim())}`;
}

export function leagueTeamsUrl(key: string, league: string): string | null {
  const id = TSDB_LEAGUE_IDS[league];
  if (!id || !isPathSafeKey(key)) return null;
  return `${THESPORTSDB_BASE}/${key}/lookup_all_teams.php?id=${id}`;
}

export function teamArtCacheKey(league: string, side: Pick<SportsSide, "id" | "name">): string {
  return `${league}:${side.id || teamKey(side.name)}`;
}

/** Only what matching and artwork need, so a league's list stays small in storage. */
const ROSTER_FIELDS = [
  "idESPN",
  "strTeam",
  "strTeamAlternate",
  "strTeamShort",
  "strSport",
  "strFanart1",
  "strFanart2",
  "strFanart3",
  "strFanart4",
  "strBanner",
  "strStadiumThumb",
  "strBadge",
  "strTeamBadge",
  "strLogo",
  "strColour1",
  "strColour2",
  "strColour3",
];

export function compactRoster(teams: unknown): TsdbTeam[] {
  if (!Array.isArray(teams)) return [];
  const out: TsdbTeam[] = [];
  for (const t of teams) {
    if (!t || typeof t !== "object") continue;
    const src = t as TsdbTeam;
    if (!teamArtOf(src)) continue;
    const row: TsdbTeam = {};
    for (const f of ROSTER_FIELDS) if (typeof src[f] === "string" && src[f]) row[f] = src[f];
    out.push(row);
  }
  return out;
}

/* ---------------- Cache with expiry ---------------- */

export const ART_HIT_TTL_MS = 7 * 24 * 3600_000;
export const ART_MISS_TTL_MS = 24 * 3600_000;
export const RETRY_TTL_MS = 10 * 60_000;
const MAX_STORED = 400;

export type ArtCacheEntry = { art: TeamArt | null; expires: number };
export type ArtCacheRecord = Record<string, ArtCacheEntry>;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

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
    const e = v as { art?: unknown; expires?: unknown } | null;
    if (!e || typeof e.expires !== "number" || e.expires <= now) continue;
    if (e.art === null) out[k] = { art: null, expires: e.expires };
    else if (e.art && typeof e.art === "object" && Array.isArray((e.art as TeamArt).fanart)) {
      const a = e.art as Record<string, unknown>;
      out[k] = {
        art: {
          fanart: strings(a.fanart),
          banner: strOrNull(a.banner),
          stadium: strOrNull(a.stadium),
          badge: strOrNull(a.badge),
          colors: strings(a.colors),
        },
        expires: e.expires,
      };
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

type RosterEntry = { teams: TsdbTeam[]; expires: number };

export function parseRosterCache(raw: string | null, now: number): Record<string, RosterEntry> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, RosterEntry> = {};
    for (const [league, v] of Object.entries(parsed)) {
      const e = v as Partial<RosterEntry> | null;
      if (!e || typeof e.expires !== "number" || e.expires <= now || !Array.isArray(e.teams))
        continue;
      out[league] = {
        teams: e.teams.filter((t) => !!t && typeof t === "object"),
        expires: e.expires,
      };
    }
    return out;
  } catch {
    return {};
  }
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
  rosterStorageKey?: string;
};

export const ART_STORAGE_KEY = "jl.sports.teamArt.v2";
export const ROSTER_STORAGE_KEY = "jl.sports.teamRoster.v1";

/**
 * One cache per app: `get` answers from memory/storage at once, `request` resolves a team (its
 * league's list first, then a name search) when nothing fresh is cached, and `subscribe` tells
 * views when an answer lands.
 */
export function createTeamArtCache(deps: TeamArtCacheDeps) {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const spacing = deps.spacingMs ?? 2100;
  const storageKey = deps.storageKey ?? ART_STORAGE_KEY;
  const rosterKey = deps.rosterStorageKey ?? ROSTER_STORAGE_KEY;
  let record: ArtCacheRecord | null = null;
  let rosters: Record<string, RosterEntry> | null = null;
  const inflight = new Map<string, Promise<TeamArt | null>>();
  const rosterInflight = new Map<string, Promise<TsdbTeam[] | null>>();
  const listeners = new Set<() => void>();
  let chain: Promise<void> = Promise.resolve();
  let lastStart = -Infinity;
  let version = 0;

  const read = (k: string): string | null => {
    try {
      return deps.storage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  const write = (k: string, v: unknown) => {
    try {
      deps.storage?.setItem(k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: the memory copy still works */
    }
  };

  const load = (): ArtCacheRecord => {
    if (!record) record = parseArtCache(read(storageKey), now());
    return record;
  };
  const loadRosters = (): Record<string, RosterEntry> => {
    if (!rosters) rosters = parseRosterCache(read(rosterKey), now());
    return rosters;
  };

  const persist = () => {
    if (!record || !deps.storage) return;
    record = trimArtCache(record);
    write(storageKey, record);
  };

  const notify = () => {
    version++;
    for (const fn of listeners) fn();
  };

  /** Runs `fn` in turn, spaced from the previous request. */
  const queued = <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve) => {
      chain = chain.then(async () => {
        const wait = lastStart + spacing - now();
        if (wait > 0) await sleep(wait);
        lastStart = now();
        resolve(await fn());
      });
    });

  const fetchTeams = async (url: string): Promise<{ ok: boolean; teams: unknown }> => {
    try {
      const res = await deps.fetchJson(url);
      if (res.status !== 200) return { ok: false, teams: null };
      return { ok: true, teams: (res.json as { teams?: unknown } | null)?.teams ?? null };
    } catch {
      return { ok: false, teams: null };
    }
  };

  /** The league's team list (cached a week), or null when TheSportsDB can't give one. */
  const roster = (key: string, league: string): Promise<TsdbTeam[] | null> => {
    const cached = loadRosters()[league];
    if (cached && cached.expires > now()) return Promise.resolve(cached.teams);
    const url = leagueTeamsUrl(key, league);
    if (!url) return Promise.resolve(null);
    const running = rosterInflight.get(league);
    if (running) return running;
    const job = queued(async () => {
      const { ok, teams } = await fetchTeams(url);
      const list = ok ? compactRoster(teams) : null;
      // A failed request is tried again later; an empty list is remembered like a miss.
      loadRosters()[league] = {
        teams: list ?? [],
        expires: now() + (ok ? (list?.length ? ART_HIT_TTL_MS : ART_MISS_TTL_MS) : RETRY_TTL_MS),
      };
      write(rosterKey, rosters);
      rosterInflight.delete(league);
      return list;
    });
    rosterInflight.set(league, job);
    return job;
  };

  /** Cached art: undefined = not known yet, null = known to have none. */
  const get = (cacheKey: string): TeamArt | null | undefined => {
    const e = load()[cacheKey];
    if (!e) return undefined;
    if (e.expires <= now()) return undefined;
    return e.art;
  };

  const settle = (cacheKey: string, art: TeamArt | null, ttl: number) => {
    load()[cacheKey] = { art, expires: now() + ttl };
    persist();
    inflight.delete(cacheKey);
    notify();
    return art;
  };

  const request = (key: string, league: string, side: ArtSide): Promise<TeamArt | null> => {
    const cacheKey = teamArtCacheKey(league, side);
    const cached = get(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached);
    const running = inflight.get(cacheKey);
    if (running) return running;
    const searchUrl = teamSearchUrl(key, side.name);
    if (!searchUrl && !leagueTeamsUrl(key, league)) return Promise.resolve(null);
    const job = (async () => {
      const list = await roster(key, league);
      const fromList = list ? pickTeamArt(list, side, league) : null;
      if (fromList) return settle(cacheKey, fromList, ART_HIT_TTL_MS);
      if (!searchUrl) return settle(cacheKey, null, ART_MISS_TTL_MS);
      return queued(async () => {
        const { ok, teams } = await fetchTeams(searchUrl);
        if (!ok) return settle(cacheKey, null, RETRY_TTL_MS);
        const art = pickTeamArt(teams, side, league);
        return settle(cacheKey, art, art ? ART_HIT_TTL_MS : ART_MISS_TTL_MS);
      });
    })();
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
