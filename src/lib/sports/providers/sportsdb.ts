import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef, SportsGame, SportsMatchDetail } from "../espn-types";
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

const BASE = "https://www.thesportsdb.com/api/v1/json/3";
const BADGE = "https://r2.thesportsdb.com/images/media/league/badge";
const DAY_CAP = 3;
const TOKEN_GAP_MS = 3000;
const BURST = 8;
const LIVE_TTL = 60_000;
const TODAY_TTL = 120_000;
const DATED_TTL = 600_000;
const SOON_MS = 10 * 60_000;
const CACHE_CAP = 240;

type Raw = Record<string, string | null | undefined>;
type Entry = { at: number; ttl: number; games: SportsGame[] };

export const SPORTSDB_LEAGUES: LeagueDef[] = [
  { key: "VTB", label: "دوري VTB المتحد", labelEn: "VTB United League", labelRu: "Единая лига ВТБ", tag: "VTB", path: "4476", logo: `${BADGE}/5jibk81521140717.png`, group: "basketball" },
  { key: "RUS", label: "الدوري الروسي", labelEn: "Russian Premier League", labelRu: "РПЛ", tag: "RUS", path: "4355", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/106.png", group: "soccer" },
  { key: "RUS2", label: "الدوري الروسي الأول", labelEn: "Russian First League", labelRu: "Первая лига", tag: "RUS2", path: "4666", logo: `${BADGE}/tbbx911752735233.png`, group: "soccer" },
  { key: "RUSVOLLEY", label: "الدوري الروسي الممتاز للكرة الطائرة", labelEn: "Russian Volleyball Super League", labelRu: "Суперлига по волейболу", tag: "RVSL", path: "4545", logo: `${BADGE}/qcfkh51570401116.png`, group: "volleyball" },
  { key: "EGY", label: "الدوري المصري الممتاز", labelEn: "Egyptian Premier League", labelRu: "Премьер-лига Египта", tag: "EGY", path: "4829", logo: `${BADGE}/v0iz601786057987.png`, group: "soccer" },
  { key: "QSL", label: "دوري نجوم قطر", labelEn: "Qatar Stars League", labelRu: "Лига звёзд Катара", tag: "QSL", path: "4663", logo: `${BADGE}/hekdan1784606842.png`, group: "soccer" },
  { key: "UAE", label: "دوري المحترفين الإماراتي", labelEn: "UAE Pro League", labelRu: "Про-лига ОАЭ", tag: "UAE", path: "4678", logo: `${BADGE}/95pes01643234997.png`, group: "soccer" },
  { key: "KLEAGUE", label: "الدوري الكوري الممتاز", labelEn: "K League 1", labelRu: "К-лига 1", tag: "KOR", path: "4689", logo: `${BADGE}/zaw2cj1628430843.png`, group: "soccer" },
  { key: "KLEAGUE2", label: "الدوري الكوري الثاني", labelEn: "K League 2", labelRu: "К-лига 2", tag: "KOR2", path: "4822", logo: `${BADGE}/p9k1qn1628430716.png`, group: "soccer" },
  { key: "KUW", label: "الدوري الكويتي الممتاز", labelEn: "Kuwait Premier League", tag: "KUW", path: "4823", logo: `${BADGE}/s2xwxu1589986519.png`, group: "soccer" },
  { key: "IRQ", label: "دوري نجوم العراق", labelEn: "Iraq Stars League", tag: "IRQ", path: "5056", logo: `${BADGE}/qcxorb1724316189.png`, group: "soccer" },
  { key: "KSA2", label: "دوري الدرجة الأولى السعودي", labelEn: "Saudi First Division", labelRu: "Первый дивизион Саудовской Аравии", tag: "KSA2", path: "5627", logo: `${BADGE}/3tsgu31746325240.png`, group: "soccer" },
  { key: "MAR", label: "البطولة المغربية", labelEn: "Botola Pro", tag: "MAR", path: "4520", logo: `${BADGE}/bhuork1638558615.png`, group: "soccer" },
  { key: "IRN", label: "الدوري الإيراني الممتاز", labelEn: "Persian Gulf Pro League", labelRu: "Про-лига Персидского залива", tag: "IRN", path: "4742", logo: `${BADGE}/4o1xer1582291199.png`, group: "soccer" },
  { key: "KBO", label: "دوري البيسبول الكوري", labelEn: "KBO League", labelRu: "КБО", tag: "KBO", path: "4830", logo: `${BADGE}/qfr1hx1589707979.png`, group: "baseball" },
];

const BY_KEY = new Map(SPORTSDB_LEAGUES.map((l) => [l.key, l] as const));
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<SportsGame[]>>();

let tokens = BURST;
let refilledAt = Date.now();
let queue: Promise<void> = Promise.resolve();
let blockedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function refill(): void {
  const gained = Math.floor((Date.now() - refilledAt) / TOKEN_GAP_MS);
  if (gained <= 0) return;
  tokens = Math.min(BURST, tokens + gained);
  refilledAt += gained * TOKEN_GAP_MS;
}

function take(): Promise<void> {
  const turn = queue.then(async () => {
    if (Date.now() < blockedUntil) return;
    refill();
    if (tokens <= 0) {
      await sleep(Math.max(0, TOKEN_GAP_MS - (Date.now() - refilledAt)));
      refill();
    }
    tokens = Math.max(0, tokens - 1);
  });
  queue = turn.catch(() => undefined);
  return turn;
}

async function fetchEvents(path: string): Promise<Raw[] | null> {
  if (Date.now() < blockedUntil) return null;
  await take();
  if (Date.now() < blockedUntil) return null;
  let res: Response;
  try {
    res = await safeFetch(`${BASE}/${path}`);
  } catch {
    return null;
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    blockedUntil = Date.now() + (retry > 0 ? retry * 1000 : 60_000);
    return null;
  }
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as { events?: unknown };
    return Array.isArray(data.events) ? (data.events as Raw[]) : [];
  } catch {
    return null;
  }
}

function dedupe(events: Raw[]): Raw[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const id = e.idEvent ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function dayEvents(leagueId: string, iso: string): Promise<Raw[] | null> {
  const day = await fetchEvents(`eventsday.php?d=${iso}&l=${leagueId}`);
  if (!day || day.length < DAY_CAP) return day;
  const round = Number(day[0].intRound);
  const season = day[0].strSeason;
  if (!(round > 0) || !season) return day;
  const extra =
    (await fetchEvents(`eventsround.php?id=${leagueId}&r=${round}&s=${encodeURIComponent(season)}`)) ?? [];
  return dedupe([...day, ...extra.filter((e) => e.dateEvent === iso)]);
}

async function currentEvents(leagueId: string): Promise<Raw[] | null> {
  const today = await dayEvents(leagueId, isoOf(localYmd()));
  if (!today || today.length > 0) return today;
  const next = (await fetchEvents(`eventsnextleague.php?id=${leagueId}`)) ?? [];
  const past = (await fetchEvents(`eventspastleague.php?id=${leagueId}`)) ?? [];
  return dedupe([...next, ...past]);
}

function startOf(e: Raw): number {
  const raw = e.strTimestamp ?? "";
  const stamp = raw ? Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`) : NaN;
  if (Number.isFinite(stamp)) return stamp;
  const fallback = e.dateEvent ? Date.parse(`${e.dateEvent}T${e.strTime || "00:00:00"}Z`) : NaN;
  return Number.isFinite(fallback) ? fallback : 0;
}

function toGame(e: Raw, def: LeagueDef): SportsGame | null {
  const id = e.idEvent;
  if (!id) return null;
  const startMs = startOf(e);
  const status = e.strStatus ?? "";
  const rawHome = e.intHomeScore ?? null;
  const rawAway = e.intAwayScore ?? null;
  const state = stateOf(status, rawHome != null && rawAway != null, startMs);
  const home = rawHome ?? (rawAway != null && state !== "pre" ? "0" : null);
  const away = rawAway ?? (rawHome != null && state !== "pre" ? "0" : null);
  const [homeWon, awayWon] = winners(state, home, away);
  return {
    id,
    league: def.tag,
    state,
    detail: detailOf(status),
    home: side(e.idHomeTeam, e.strHomeTeam, e.strHomeTeamBadge, home, homeWon),
    away: side(e.idAwayTeam, e.strAwayTeam, e.strAwayTeamBadge, away, awayWon),
    startMs,
  };
}

function ttlOf(games: SportsGame[], dated: boolean): number {
  const now = Date.now();
  const hot = games.some(
    (g) =>
      g.state === "in" ||
      (g.state === "pre" && g.startMs > 0 && Math.abs(g.startMs - now) < SOON_MS),
  );
  if (hot) return LIVE_TTL;
  return dated ? DATED_TTL : TODAY_TTL;
}

function remember(key: string, entry: Entry): void {
  cache.delete(key);
  cache.set(key, entry);
  for (const oldest of cache.keys()) {
    if (cache.size <= CACHE_CAP) break;
    cache.delete(oldest);
  }
}

function fetchScoreboard(leagueKey: string, dateYmd?: string): Promise<SportsGame[]> {
  const def = BY_KEY.get(leagueKey);
  if (!def) return Promise.resolve([]);
  const today = localYmd();
  const key = `${def.key}@${dateYmd ?? "now"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.games);
  const existing = inflight.get(key);
  if (existing) return existing;
  const load = dateYmd ? dayEvents(def.path, isoOf(dateYmd)) : currentEvents(def.path);
  const p = load
    .then((events) => {
      if (!events) return hit?.games ?? [];
      const games = events.map((e) => toGame(e, def)).filter((g): g is SportsGame => g !== null);
      remember(key, { at: Date.now(), ttl: ttlOf(games, !!dateYmd && dateYmd !== today), games });
      return games;
    })
    .catch(() => hit?.games ?? [])
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchSummary(leagueKey: string, eventId: string): Promise<SportsMatchDetail | null> {
  const def = BY_KEY.get(leagueKey);
  if (!def) return null;
  const raw = (await fetchEvents(`lookupevent.php?id=${encodeURIComponent(eventId)}`))?.[0];
  const game = raw ? toGame(raw, def) : null;
  return game ? emptyDetail(game) : null;
}

export const sportsDbProvider: SportsProvider = {
  id: "thesportsdb",
  label: "TheSportsDB",
  listLeagues: () => SPORTSDB_LEAGUES,
  fetchScoreboard,
  fetchSummary,
};
