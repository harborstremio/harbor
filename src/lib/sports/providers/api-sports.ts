import { safeFetch } from "@/lib/safe-fetch";
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

const FOOTBALL = "https://v3.football.api-sports.io";
const HOCKEY = "https://v1.hockey.api-sports.io";
const MEDIA = "https://media.api-sports.io";
const SETTINGS_KEY = "harbor.settings";
const SCHEDULE_TTL = 600_000;
const DATED_TTL = 1_800_000;
const DETAIL_TTL = 60_000;
const SETTLED_DETAIL_TTL = 600_000;
const SOON_MS = 15 * 60_000;
const CACHE_CAP = 120;

type Sport = "football" | "hockey";
type Entry<T> = { at: number; ttl: number; value: T };

export const API_SPORTS_LEAGUES: LeagueDef[] = [
  { key: "EGY", label: "الدوري المصري الممتاز", labelEn: "Egyptian Premier League", labelRu: "Премьер-лига Египта", tag: "EGY", path: "football/233", logo: `${MEDIA}/football/leagues/233.png`, group: "soccer" },
  { key: "QSL", label: "دوري نجوم قطر", labelEn: "Qatar Stars League", labelRu: "Лига звёзд Катара", tag: "QSL", path: "football/305", logo: `${MEDIA}/football/leagues/305.png`, group: "soccer" },
  { key: "UAE", label: "دوري المحترفين الإماراتي", labelEn: "UAE Pro League", labelRu: "Про-лига ОАЭ", tag: "UAE", path: "football/301", logo: `${MEDIA}/football/leagues/301.png`, group: "soccer" },
  { key: "KLEAGUE", label: "الدوري الكوري الممتاز", labelEn: "K League 1", labelRu: "К-лига 1", tag: "KOR", path: "football/292", logo: `${MEDIA}/football/leagues/292.png`, group: "soccer" },
  { key: "KHL", label: "دوري الهوكي القاري", labelEn: "KHL", labelRu: "КХЛ", tag: "KHL", path: "hockey/35", logo: `${MEDIA}/hockey/leagues/35.png`, group: "hockey" },
];

const BY_KEY = new Map(API_SPORTS_LEAGUES.map((l) => [l.key, l] as const));
const BY_PATH = new Map(API_SPORTS_LEAGUES.map((l) => [l.path, l] as const));
const boards = new Map<string, Entry<SportsGame[]>>();
const boardInflight = new Map<string, Promise<SportsGame[] | null>>();
const details = new Map<string, Entry<SportsMatchDetail | null>>();

let dayRemaining = Number.POSITIVE_INFINITY;
let minuteBlockedUntil = 0;
let dayBlockedUntil = 0;
let rejectedKey = "";

export function readSportsApiKey(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return typeof s.sportsApiKey === "string" ? s.sportsApiKey.trim() : "";
  } catch {
    return "";
  }
}

function sportOf(def: LeagueDef): Sport {
  return def.path.startsWith("hockey/") ? "hockey" : "football";
}

function nextUtcMidnight(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function noteHeaders(headers: Headers): void {
  const day = headers.get("x-ratelimit-requests-remaining");
  if (day != null && Number.isFinite(Number(day))) dayRemaining = Number(day);
  const minute = headers.get("x-ratelimit-remaining");
  if (minute != null && Number(minute) <= 0) minuteBlockedUntil = Date.now() + 60_000;
}

async function apiGet(sport: Sport, path: string): Promise<Raw[] | null> {
  const key = readSportsApiKey();
  if (!key || key === rejectedKey) return null;
  const now = Date.now();
  if (now < dayBlockedUntil || now < minuteBlockedUntil) return null;
  let res: Response;
  try {
    res = await safeFetch(`${sport === "hockey" ? HOCKEY : FOOTBALL}${path}`, {
      headers: { "x-apisports-key": key },
    });
  } catch {
    return null;
  }
  noteHeaders(res.headers);
  if (res.status === 429) {
    minuteBlockedUntil = Date.now() + 60_000;
    return null;
  }
  if (!res.ok) return null;
  let data: { errors?: unknown; response?: unknown };
  try {
    data = (await res.json()) as { errors?: unknown; response?: unknown };
  } catch {
    return null;
  }
  const errors =
    data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)
      ? (data.errors as Record<string, unknown>)
      : {};
  if ("token" in errors) rejectedKey = key;
  if ("requests" in errors) dayBlockedUntil = nextUtcMidnight();
  if ("rateLimit" in errors) minuteBlockedUntil = Date.now() + 60_000;
  if (Object.keys(errors).length > 0) return null;
  return Array.isArray(data.response) ? (data.response as Raw[]) : [];
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
  if (fx.id == null) return null;
  const short = String(fx.status?.short ?? "");
  const startMs = startOf(fx);
  const home = f.goals?.home ?? null;
  const away = f.goals?.away ?? null;
  const state = stateOf(short, home != null && away != null, startMs);
  const penalties: Raw = f.score?.penalty ?? {};
  const decided = home === away && penalties.home != null ? [penalties.home, penalties.away] : [home, away];
  const [homeWon, awayWon] = winners(state, decided[0], decided[1]);
  return {
    id: String(fx.id),
    league: def.tag,
    state,
    detail: detailOf(short, fx.status?.elapsed),
    home: side(f.teams?.home?.id, f.teams?.home?.name, f.teams?.home?.logo, home, homeWon),
    away: side(f.teams?.away?.id, f.teams?.away?.name, f.teams?.away?.logo, away, awayWon),
    startMs,
  };
}

function hockeyGame(g: Raw, def: LeagueDef): SportsGame | null {
  if (g.id == null) return null;
  const short = String(g.status?.short ?? "");
  const startMs = startOf(g);
  const home = g.scores?.home ?? null;
  const away = g.scores?.away ?? null;
  const state = stateOf(short, home != null && away != null, startMs);
  const [homeWon, awayWon] = winners(state, home, away);
  return {
    id: String(g.id),
    league: def.tag,
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
    const def = BY_PATH.get(`${sport}/${row.league?.id}`);
    if (!def) continue;
    const game = sport === "hockey" ? hockeyGame(row, def) : footballGame(row, def);
    if (game) out.push(game);
  }
  return out;
}

function liveTtl(): number {
  if (dayRemaining > 400) return 60_000;
  if (dayRemaining > 120) return 120_000;
  if (dayRemaining > 30) return 300_000;
  return 900_000;
}

function boardTtl(games: SportsGame[], iso: string): number {
  const now = Date.now();
  const hot = games.some(
    (g) =>
      g.state === "in" ||
      (g.state === "pre" && g.startMs > 0 && Math.abs(g.startMs - now) < SOON_MS),
  );
  if (hot) return liveTtl();
  return iso === isoOf(localYmd()) ? SCHEDULE_TTL : DATED_TTL;
}

function board(sport: Sport, iso: string): Promise<SportsGame[] | null> {
  const key = `${sport}@${iso}`;
  const hit = boards.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.value);
  const existing = boardInflight.get(key);
  if (existing) return existing;
  const path = sport === "hockey" ? `/games?date=${iso}` : `/fixtures?date=${iso}`;
  const p = apiGet(sport, path)
    .then((rows) => {
      if (!rows) return hit?.value ?? null;
      const games = parseBoard(sport, rows);
      remember(boards, key, { at: Date.now(), ttl: boardTtl(games, iso), value: games });
      return games;
    })
    .finally(() => boardInflight.delete(key));
  boardInflight.set(key, p);
  return p;
}

async function fetchScoreboard(leagueKey: string, dateYmd?: string): Promise<SportsGame[]> {
  const def = BY_KEY.get(leagueKey);
  if (!def || !readSportsApiKey()) return [];
  const games = await board(sportOf(def), isoOf(dateYmd ?? localYmd()));
  return (games ?? []).filter((g) => g.league === def.tag);
}

async function footballDetail(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
  const f = (await apiGet("football", `/fixtures?id=${encodeURIComponent(eventId)}`))?.[0];
  const game = f ? footballGame(f, def) : null;
  return f && game ? footballDetailOf(f, game) : null;
}

async function hockeyDetail(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
  const g = (await apiGet("hockey", `/games?id=${encodeURIComponent(eventId)}`))?.[0];
  const game = g ? hockeyGame(g, def) : null;
  if (!g || !game) return null;
  const detail = emptyDetail(game);
  if (g.events !== true) return detail;
  const events = (await apiGet("hockey", `/games/events?game=${encodeURIComponent(eventId)}`)) ?? [];
  return { ...detail, events: hockeyEventsOf(events) };
}

async function fetchSummary(leagueKey: string, eventId: string): Promise<SportsMatchDetail | null> {
  const def = BY_KEY.get(leagueKey);
  if (!def || !readSportsApiKey()) return null;
  const key = `${def.key}#${eventId}`;
  const hit = details.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const value = await (sportOf(def) === "hockey" ? hockeyDetail(def, eventId) : footballDetail(def, eventId));
  if (!value) return hit?.value ?? null;
  const ttl = value.state === "in" ? Math.max(DETAIL_TTL, liveTtl()) : SETTLED_DETAIL_TTL;
  remember(details, key, { at: Date.now(), ttl, value });
  return value;
}

export const apiSportsProvider: SportsProvider = {
  id: "api-sports",
  label: "API-Sports",
  listLeagues: () => API_SPORTS_LEAGUES,
  fetchScoreboard,
  fetchSummary,
  get needsKey() {
    return readSportsApiKey() === "";
  },
};
