import { fetch as nativeFetch } from "@tauri-apps/plugin-http";
import { readSportsApiKey } from "../api-credentials";
export { readSportsApiKey } from "../api-credentials";
import { createApiSportsTransport, ApiSportsError, type ApiSport } from "./api-sports-transport";
import type { LeagueDef, SportsGame, SportsMatchDetail } from "../espn-types";
import { footballDetailOf, hockeyEventsOf, type Raw } from "./api-sports-detail";
import {
  detailOf,
  emptyDetail,
  isoOf,
  localYmd,
  side,
  stateOf,
  winners,
  type SportsProvider,
} from "./shared";

const MEDIA = "https://media.api-sports.io";
const SCHEDULE_TTL = 600_000;
const DATED_TTL = 1_800_000;
const DETAIL_TTL = 60_000;
const SETTLED_DETAIL_TTL = 600_000;
const SOON_MS = 15 * 60_000;
const CACHE_CAP = 120;

type Sport = "football" | "hockey";
type Entry<T> = { at: number; ttl: number; value: T };

export const API_SPORTS_LEAGUES: LeagueDef[] = [
  {
    key: "EGY",
    label: "الدوري المصري الممتاز",
    labelEn: "Egyptian Premier League",
    labelRu: "Премьер-лига Египта",
    tag: "EGY",
    path: "football/233",
    logo: `${MEDIA}/football/leagues/233.png`,
    group: "soccer",
  },
  {
    key: "QSL",
    label: "دوري نجوم قطر",
    labelEn: "Qatar Stars League",
    labelRu: "Лига звёзд Катара",
    tag: "QSL",
    path: "football/305",
    logo: `${MEDIA}/football/leagues/305.png`,
    group: "soccer",
  },
  {
    key: "UAE",
    label: "دوري المحترفين الإماراتي",
    labelEn: "UAE Pro League",
    labelRu: "Про-лига ОАЭ",
    tag: "UAE",
    path: "football/301",
    logo: `${MEDIA}/football/leagues/301.png`,
    group: "soccer",
  },
  {
    key: "KLEAGUE",
    label: "الدوري الكوري الممتاز",
    labelEn: "K League 1",
    labelRu: "К-лига 1",
    tag: "KOR",
    path: "football/292",
    logo: `${MEDIA}/football/leagues/292.png`,
    group: "soccer",
  },
  {
    key: "KHL",
    label: "دوري الهوكي القاري",
    labelEn: "KHL",
    labelRu: "КХЛ",
    tag: "KHL",
    path: "hockey/35",
    logo: `${MEDIA}/hockey/leagues/35.png`,
    group: "hockey",
  },
];

const BY_KEY = new Map(API_SPORTS_LEAGUES.map((l) => [l.key, l] as const));
const BY_PATH = new Map(API_SPORTS_LEAGUES.map((l) => [l.path, l] as const));
const FOOTBALL_STATUS = new Set(
  "TBD NS 1H HT 2H ET BT P SUSP INT FT AET PEN PST CANC ABD AWD WO LIVE".split(" "),
);
const HOCKEY_STATUS = new Set("NS P1 P2 P3 OT PT BT AW POST CANC INTR ABD AOT AP FT".split(" "));
export function createApiSportsProvider(options: {
  getKey: () => string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  timeoutMs?: number;
}) {
  const now = options.now ?? Date.now;
  const transport = createApiSportsTransport(options);
  const boards = new Map<string, Entry<SportsGame[]>>();
  type BoardJob = { task: Promise<SportsGame[]>; controller: AbortController; users: number };
  const boardInflight = new Map<string, BoardJob>();
  const details = new Map<string, Entry<SportsMatchDetail | null>>();
  const detailInflight = new Map<string, Promise<SportsMatchDetail | null>>();
  let generation = transport.generation();
  function syncCredentials() {
    const current = transport.generation();
    if (generation !== current) {
      generation = current;
      boards.clear();
      details.clear();
      boardInflight.clear();
      detailInflight.clear();
    }
    return current;
  }
  function sportOf(def: LeagueDef): Sport {
    return def.path.startsWith("hockey/") ? "hockey" : "football";
  }
  function apiGet(sport: Sport, path: string, signal?: AbortSignal): Promise<Raw[]> {
    return transport.get(sport, path, signal);
  }
  function remember<T>(store: Map<string, Entry<T>>, key: string, entry: Entry<T>): void {
    store.delete(key);
    store.set(key, entry);
    for (const oldest of store.keys()) {
      if (store.size <= CACHE_CAP) break;
      store.delete(oldest);
    }
  }

  function startOf(row: Raw): number {
    if (typeof row.timestamp === "number") return row.timestamp * 1000;
    const parsed = Date.parse(String(row.date ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function footballGame(f: Raw, def: LeagueDef): SportsGame | null {
    const fx: Raw = f.fixture ?? {};
    if (
      fx.id == null ||
      String(f.league?.id) !== def.path.split("/")[1] ||
      !f.teams?.home?.id ||
      !f.teams?.away?.id ||
      !f.teams.home.name ||
      !f.teams.away.name
    )
      return null;
    const short = String(fx.status?.short ?? "");
    const startMs = startOf(fx);
    if (!FOOTBALL_STATUS.has(short) || !Number.isFinite(startMs) || startMs <= 0) return null;
    const home = f.goals?.home ?? null;
    const away = f.goals?.away ?? null;
    const state = stateOf(short, home != null && away != null, startMs);
    const penalties: Raw = f.score?.penalty ?? {};
    const decided =
      home === away && penalties.home != null ? [penalties.home, penalties.away] : [home, away];
    const [homeWon, awayWon] = winners(state, decided[0], decided[1]);
    return {
      id: String(fx.id),
      league: def.tag,
      source: "api-sports",
      state,
      detail: detailOf(short, fx.status?.elapsed),
      home: side(f.teams?.home?.id, f.teams?.home?.name, f.teams?.home?.logo, home, homeWon),
      away: side(f.teams?.away?.id, f.teams?.away?.name, f.teams?.away?.logo, away, awayWon),
      startMs,
    };
  }

  function hockeyGame(g: Raw, def: LeagueDef): SportsGame | null {
    if (
      g.id == null ||
      String(g.league?.id) !== def.path.split("/")[1] ||
      !g.teams?.home?.id ||
      !g.teams?.away?.id ||
      !g.teams.home.name ||
      !g.teams.away.name
    )
      return null;
    const short = String(g.status?.short ?? "");
    const startMs = startOf(g);
    if (!HOCKEY_STATUS.has(short) || !Number.isFinite(startMs) || startMs <= 0) return null;
    const home = g.scores?.home ?? null;
    const away = g.scores?.away ?? null;
    const state = stateOf(short, home != null && away != null, startMs);
    const [homeWon, awayWon] = winners(state, home, away);
    return {
      id: String(g.id),
      league: def.tag,
      source: "api-sports",
      state,
      detail: detailOf(short, null, typeof g.timer === "string" ? g.timer : null),
      home: side(g.teams?.home?.id, g.teams?.home?.name, g.teams?.home?.logo, home, homeWon),
      away: side(g.teams?.away?.id, g.teams?.away?.name, g.teams?.away?.logo, away, awayWon),
      startMs,
    };
  }

  function parseBoard(sport: Sport, rows: Raw[]): SportsGame[] {
    const out: SportsGame[] = [];
    for (const row of rows) {
      if (!row.league?.id || !(sport === "football" ? row.fixture?.id : row.id))
        throw new ApiSportsError("unavailable");
      const def = BY_PATH.get(`${sport}/${row.league?.id}`);
      if (!def) continue;
      const game = sport === "hockey" ? hockeyGame(row, def) : footballGame(row, def);
      if (!game || !game.startMs) throw new ApiSportsError("unavailable");
      out.push(game);
    }
    return out;
  }

  function liveTtl(sport: Sport): number {
    const dayRemaining = transport.remaining(sport);
    if (dayRemaining > 400) return 60_000;
    if (dayRemaining > 120) return 120_000;
    if (dayRemaining > 30) return 300_000;
    return 900_000;
  }

  function boardTtl(games: SportsGame[], iso: string, sport: Sport): number {
    const time = now();
    const hot = games.some(
      (g) =>
        g.state === "in" ||
        (g.state === "pre" && g.startMs > 0 && Math.abs(g.startMs - time) < SOON_MS),
    );
    if (hot) return liveTtl(sport);
    return iso === isoOf(localYmd()) ? SCHEDULE_TTL : DATED_TTL;
  }

  function board(sport: Sport, iso: string, signal?: AbortSignal): Promise<SportsGame[]> {
    if (signal?.aborted) return Promise.reject(new DOMException("Request cancelled", "AbortError"));
    const version = syncCredentials();
    const key = `${sport}@${iso}`;
    const hit = boards.get(key);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.value);
    let job = boardInflight.get(key);
    if (!job) {
      const controller = new AbortController();
      const path = sport === "hockey" ? `/games?date=${iso}` : `/fixtures?date=${iso}`;
      const current: BoardJob = { controller, users: 0, task: Promise.resolve([]) };
      current.task = apiGet(sport, path, controller.signal)
        .then((rows) => {
          controller.signal.throwIfAborted();
          if (version !== syncCredentials()) throw new ApiSportsError("unavailable");
          const games = parseBoard(sport, rows);
          remember(boards, key, { at: now(), ttl: boardTtl(games, iso, sport), value: games });
          return games;
        })
        .finally(() => {
          if (boardInflight.get(key) === current) boardInflight.delete(key);
        });
      boardInflight.set(key, current);
      job = current;
    }
    const subscribed = job;
    subscribed.users++;
    return new Promise<SportsGame[]>((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        signal?.removeEventListener("abort", abort);
        subscribed.users--;
        if (subscribed.users === 0 && boardInflight.get(key) === subscribed) {
          boardInflight.delete(key);
          subscribed.controller.abort();
        }
      };
      const abort = () => {
        release();
        reject(new DOMException("Request cancelled", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      subscribed.task.then(
        (value) => {
          release();
          resolve(value);
        },
        (error) => {
          release();
          reject(error);
        },
      );
    });
  }
  async function fetchScoreboard(
    leagueKey: string,
    dateYmd?: string,
    signal?: AbortSignal,
  ): Promise<SportsGame[]> {
    syncCredentials();
    if (dateYmd) {
      const iso = isoOf(dateYmd),
        parsed = Date.parse(iso);
      if (
        !/^\d{8}$/.test(dateYmd) ||
        !Number.isFinite(parsed) ||
        new Date(parsed).toISOString().slice(0, 10) !== iso
      )
        throw new ApiSportsError("unavailable");
    }
    const def = BY_KEY.get(leagueKey);
    if (!def) return [];
    if (!options.getKey().trim()) throw new ApiSportsError("missing-key");
    const games = await board(sportOf(def), isoOf(dateYmd ?? localYmd()), signal);
    return (games ?? []).filter((g) => g.league === def.tag);
  }

  async function footballDetail(
    def: LeagueDef,
    eventId: string,
  ): Promise<SportsMatchDetail | null> {
    // Documented batch-by-ID response includes available events, lineups and statistics in one call.
    // https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league
    const f = (await apiGet("football", `/fixtures?ids=${encodeURIComponent(eventId)}`))?.[0];
    const game = f && String(f.fixture?.id) === eventId ? footballGame(f, def) : null;
    return f && game ? footballDetailOf(f, game) : null;
  }

  async function hockeyDetail(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
    const g = (await apiGet("hockey", `/games?id=${encodeURIComponent(eventId)}`))?.[0];
    const game = g && String(g.id) === eventId ? hockeyGame(g, def) : null;
    if (!g || !game) return null;
    const detail = emptyDetail(game);
    if (g.events !== true) return detail;
    const events =
      (await apiGet("hockey", `/games/events?game=${encodeURIComponent(eventId)}`)) ?? [];
    return { ...detail, events: hockeyEventsOf(events) };
  }

  async function fetchSummary(
    leagueKey: string,
    eventId: string,
  ): Promise<SportsMatchDetail | null> {
    const def = BY_KEY.get(leagueKey);
    if (!def || !options.getKey()) return null;
    if (!/^\d+$/.test(eventId)) return null;
    const version = syncCredentials();
    const key = `${def.key}#${eventId}`;
    const hit = details.get(key);
    if (hit && now() - hit.at < hit.ttl) return hit.value;
    const existing = detailInflight.get(key);
    if (existing) return existing;
    const task = (async () => {
      const value = await (
        sportOf(def) === "hockey" ? hockeyDetail(def, eventId) : footballDetail(def, eventId)
      ).catch(() => null);
      if (version !== syncCredentials()) return null;
      if (!value) return hit?.value ?? null;
      const ttl =
        value.state === "in" ? Math.max(DETAIL_TTL, liveTtl(sportOf(def))) : SETTLED_DETAIL_TTL;
      remember(details, key, { at: now(), ttl, value });
      return value;
    })().finally(() => {
      if (detailInflight.get(key) === task) detailInflight.delete(key);
    });
    detailInflight.set(key, task);
    return task;
  }

  const provider: SportsProvider = {
    id: "api-sports",
    label: "API-Sports",
    listLeagues: () => API_SPORTS_LEAGUES,
    fetchScoreboard,
    fetchSummary,
    get needsKey() {
      return options.getKey().trim() === "";
    },
  };

  return {
    provider,
    fetchScoreboard,
    status: (sport: ApiSport = "football") => transport.status(sport),
    subscribe: transport.subscribe,
    invalidate: syncCredentials,
  };
}
const apiSports = createApiSportsProvider({
  getKey: readSportsApiKey,
  fetch: (url, init) => {
    // Credentials go only to the provider, never Harbor's generic web proxy or a redirect target.
    const request = { ...init, credentials: "omit" as const, redirect: "error" as const };
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
      ? nativeFetch(url, { ...request, maxRedirections: 0 })
      : fetch(url, request);
  },
});
export const apiSportsProvider = apiSports.provider;
export const getApiSportsStatus = apiSports.status;
export const subscribeApiSportsStatus = apiSports.subscribe;
export const invalidateApiSportsCredentials = apiSports.invalidate;

export const fetchApiSportsScoreboard = apiSports.fetchScoreboard;
