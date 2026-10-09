import { allowDirectHost, safeFetch } from "@/lib/safe-fetch";
import { isFinishedStatus, publishedDateOnly } from "./event-status";
import { LEAGUES, LEAGUE_GROUPS, SITE_BASE } from "./espn-leagues";
import { parseEvents } from "./espn-parse";
import { isGameOnLocalDay, sportsDbTimestamp } from "./slice-calendar";
import type { LeagueDef, SportsGame } from "./espn-types";
export { readSportsSlice, saveSportsSlice } from "./slice-storage";
import { parseDotaMatches } from "./opendota";
import { ESPORTS_GAMES } from "./esports-catalog";
import { fetchOneSchedule, ONE_LOGO } from "./providers/one-schedule";
import { boxingOnDay, fetchBoxingCalendars, mergeBoxingGames } from "./providers/boxing-schedule";
import { REGIONAL_DB_LEAGUES, REGIONAL_SOCCER_ALIASES } from "./regional-sports-catalog";
import { ADDITIONAL_LEAGUES } from "./additional-sports-catalog";
import { MOTORSPORT_LEAGUES } from "./motorsport-catalog";
import { loadMotorsportSchedule, utcCalendarDates } from "./motorsport-schedule-cache";
import { fetchLiveScoreboardEvents } from "./live-scoreboard";
import { EXPANDED_SPORTS_LEAGUES } from "./expanded-sports-catalog";
import { AUSTRALIAN_DB_LEAGUES } from "./australian-sports-catalog";
import { apiLeagueForHub, optionalApiHubSlice } from "./api-hub-leagues";
import { readSportsApiKey } from "./api-credentials";

const DB = "https://www.thesportsdb.com/api/v1/json/123";
// These public ESPN feeds allow CORS. Native can try them directly before its bridge fallback.
allowDirectHost(SITE_BASE);
allowDirectHost("https://sports.core.api.espn.com");
const dbLeague = (
  key: string,
  label: string,
  path: string,
  group: string,
  badge = "",
): LeagueDef => ({
  key,
  label,
  labelEn: label,
  tag: key,
  path,
  group,
  logo: badge ? `https://r2.thesportsdb.com/images/media/league/badge/${badge}.png` : "",
});
const esportsLogo = (id: string) => ESPORTS_GAMES.find((game) => game.id === id)!.logo;
export const HUB_LEAGUES = [
  ...LEAGUES,
  ...MOTORSPORT_LEAGUES,
  ...REGIONAL_DB_LEAGUES,
  ...EXPANDED_SPORTS_LEAGUES,
  ...AUSTRALIAN_DB_LEAGUES,
  ...ADDITIONAL_LEAGUES.filter((league) => /^\d+$/.test(league.path)),
  {
    ...dbLeague("DOTA2", "Dota 2", "opendota", "esports"),
    logo: ESPORTS_GAMES.find((game) => game.id === "dota2")!.logo,
  },
  dbLeague("LCK", "League of Legends · LCK", "4529", "esports", "llpp2i1705953103"),
  dbLeague("LEC", "League of Legends · LEC", "4530", "esports", "djubyo1705150930"),
  dbLeague("LPL", "League of Legends · LPL", "4528", "esports", "fqgzgl1706041210"),
  dbLeague("RLCS", "Rocket League", "5421", "esports", "q9qgwg1705154603"),
  // The esports rail fetches these two titles itself; there is no day-schedule feed for them.
  { ...dbLeague("CS2", "Counter-Strike 2", "esports-feed", "esports"), logo: esportsLogo("cs2") },
  { ...dbLeague("VALORANT", "VALORANT", "esports-feed", "esports"), logo: esportsLogo("valorant") },
  dbLeague("BOXING", "Boxing", "4445", "boxing", "j14hx41784791003"),
  // Schedule-only free feeds, requested only for the selected sports/leagues.
  dbLeague("OKTAGON", "Oktagon MMA", "5702", "combat", "4fqdkd1759141220"),
  {
    key: "ONE",
    label: "ONE Championship",
    labelEn: "ONE Championship",
    tag: "ONE",
    path: "official-one",
    group: "combat",
    logo: ONE_LOGO,
  },
  dbLeague("SUPERCARS", "Supercars Championship", "4489", "motorsport", "64f67s1770108650"),
  dbLeague("BTCC", "British Touring Car Championship", "4372", "motorsport", "a0xreq1556444753"),
  dbLeague("BRITISHGT", "British GT Championship", "4410", "motorsport", "w2h8gq1547547800"),
  dbLeague("WORLDSSP", "World Supersport", "5873", "motorsport", "1adg221775893214"),
];
export const HUB_GROUPS = [
  ...LEAGUE_GROUPS,
  { key: "boxing", label: "الملاكمة", labelEn: "Boxing", icon: "🥊" },
  { key: "esports", label: "الرياضات الإلكترونية", labelEn: "Esports", icon: "🎮" },
];
// A broad first visit across every offered sport. Saved choices, including an
// explicitly empty selection, take precedence in selectedSportsLeagues.
export const HUB_DEFAULTS = [
  "EPL",
  "UCL",
  "LALIGA",
  "SERIEA",
  "BUNDESLIGA",
  "LIGUE1",
  "BRASILEIRAO",
  "ROSHN",
  "EGYPT",
  "UAE",
  "QATAR",
  "NWSL",
  "NBA",
  "WNBA",
  "EUROLEAGUE",
  "NFL",
  "NCAAF",
  "MLB",
  "NHL",
  "UFC",
  "ONE",
  "F1",
  "NASCAR",
  "INDYCAR",
  "MOTOGP",
  "TENNIS",
  "TENNIS_WTA",
  "PGA",
  "LPGA",
  "URC",
  "IPL",
  "WPL",
  "AFL",
  "PLL",
  "VNL_M",
  "VNL_W",
  "EHF_CL",
  "BWF",
  "WTT",
  "WST",
  "PDC",
  "SUPER_NETBALL",
  "FIH_PRO",
  "UCI_WT",
  "FIS_ALPINE",
  "DIAMOND_LEAGUE",
  "NCAA_SOFTBALL",
  "BOXING",
  "DOTA2",
  "LCK",
  "CS2",
  "VALORANT",
];
export const hubLeague = (tag: string) => HUB_LEAGUES.find((l) => l.tag === tag);
export const dayStamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
/** ESPN's scoreboard rejects day ranges; a window is fetched as the whole months it touches. */
export function monthStamps(day: string, spanDays: number): string[] {
  const end = addDays(day, spanDays);
  return [...new Set([day.slice(0, 6), end.slice(0, 6)])];
}
export function addDays(day: string, n: number) {
  const d = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8));
  d.setDate(d.getDate() + n);
  return dayStamp(d);
}
export async function sportsJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 9000);
  try {
    const response = await safeFetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Sports feed ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

type DbEvent = Record<string, string | null>;
export function parseDbEvents(events: DbEvent[], def: LeagueDef): SportsGame[] {
  return events.flatMap((e) => {
    if (e.idLeague && /^\d+$/.test(def.path) && e.idLeague !== def.path) return [];
    const ms = sportsDbTimestamp(e.strTimestamp, e.dateEvent, e.strTime);
    if (!e.idEvent || !Number.isFinite(ms)) return [];
    const dateOnly = publishedDateOnly(e.strTimestamp, e.dateEvent, e.strTime);
    const finished = isFinishedStatus(e.strStatus) || !!(e.strResult || "").trim();
    // The free schedule feed is not a live score service. Never infer LIVE from the clock.
    return [
      {
        id: e.idEvent,
        source: "thesportsdb-hub",
        league: def.tag,
        state: finished ? ("post" as const) : ("pre" as const),
        startMs: ms,
        ...(dateOnly ? { dateOnly } : {}),
        artwork: e.strThumb || undefined,
        poster: e.strPoster || undefined,
        detail: e.strStatus || "",
        home: {
          id: e.idHomeTeam || "",
          name: e.strHomeTeam || e.strEvent || def.labelEn,
          abbr: "",
          logo: e.strHomeTeamBadge || "",
          score: e.intHomeScore || "",
          winner: false,
        },
        away: {
          id: e.idAwayTeam || "",
          name: e.strAwayTeam || "",
          abbr: "",
          logo: e.strAwayTeamBadge || "",
          score: e.intAwayScore || "",
          winner: false,
        },
        context: {
          id: e.idEvent,
          name: e.strEvent || def.labelEn,
          round: e.strRound || "",
          draw: "",
          venue: e.strVenue || "",
          major: false,
        },
      },
    ];
  });
}

export async function fetchHubSlice(key: string, signal: AbortSignal): Promise<SportsGame[]> {
  const [leagueKey, day, mode] = key.split("@");
  if (leagueKey === "ONE") {
    const games = await fetchOneSchedule(signal);
    return games.filter((game) =>
      mode === "upcoming"
        ? game.state !== "post" && dayStamp(new Date(game.startMs)) >= day
        : dayStamp(new Date(game.startMs)) === day,
    );
  }
  if (leagueKey === "DOTA2") {
    if (mode === "upcoming") return [];
    const feeds = await Promise.allSettled([
      sportsJson("https://api.opendota.com/api/proMatches", signal).then((data) =>
        parseDotaMatches(data, false).filter((game) => dayStamp(new Date(game.startMs)) === day),
      ),
      ...(day === dayStamp(new Date())
        ? [
            sportsJson("https://api.opendota.com/api/live", signal).then((data) =>
              parseDotaMatches(data, true),
            ),
          ]
        : []),
    ]);
    const successful = feeds.filter(
      (feed): feed is PromiseFulfilledResult<SportsGame[]> => feed.status === "fulfilled",
    );
    if (!successful.length) throw new Error("Dota feeds are unavailable");
    return successful.flatMap((feed) => feed.value);
  }
  if (leagueKey === "SOCCER_ALL") {
    if (mode === "live")
      return parseSoccerBoard(
        await fetchLiveScoreboardEvents(
          `${SITE_BASE}/soccer/all/scoreboard`,
          day,
          signal,
          sportsJson,
        ),
      );
    const data = await sportsJson(
      `${SITE_BASE}/soccer/all/scoreboard?dates=${day}&limit=1000`,
      signal,
    );
    if (!Array.isArray(data.events)) throw new Error("Invalid soccer scoreboard");
    return parseSoccerBoard(data.events);
  }
  const def = HUB_LEAGUES.find((l) => l.key === leagueKey);
  if (!def) return [];
  // Esports rail titles: the match feeds carry their schedule, so a day slice has no source.
  if (def.path === "esports-feed") return [];
  const paidLeague = apiLeagueForHub(leagueKey);
  if (paidLeague && mode !== "upcoming" && readSportsApiKey()) {
    const { fetchApiSportsScoreboard } = await import("./providers/api-sports");
    const games = await optionalApiHubSlice(def.tag, day, mode, signal, fetchApiSportsScoreboard);
    if (games !== null) return games;
    // Retain public calendar access when the optional account is unavailable.
  }
  if (leagueKey === "BOXING") {
    const urls =
      mode === "upcoming"
        ? [`${DB}/eventsnextleague.php?id=${def.path}`]
        : utcCalendarDates(day).map((iso) => `${DB}/eventsday.php?d=${iso}&l=${def.path}`);
    const results = await Promise.allSettled([
      fetchBoxingCalendars(signal),
      Promise.all(
        urls.map(async (url) => {
          const data = await loadMotorsportSchedule(url, signal, sportsJson);
          return parseDbEvents((data.events ?? []) as DbEvent[], def);
        }),
      ).then((pages) => pages.flat()),
    ]);
    signal.throwIfAborted();
    if (results.every((result) => result.status === "rejected"))
      throw new Error("Boxing schedules unavailable");
    const official = results[0].status === "fulfilled" ? results[0].value : [];
    const supplemental = results[1].status === "fulfilled" ? results[1].value : [];
    return mergeBoxingGames(official, supplemental).filter((game) =>
      boxingOnDay(game, day, mode === "upcoming"),
    );
  }
  if (/^\d+$/.test(def.path)) {
    const urls =
      mode === "upcoming"
        ? [`${DB}/eventsnextleague.php?id=${def.path}`]
        : utcCalendarDates(day).map((iso) => `${DB}/eventsday.php?d=${iso}&l=${def.path}`);
    const pages = await Promise.all(
      urls.map(async (url) => {
        const data = await loadMotorsportSchedule(url, signal, sportsJson);
        if (!("events" in data)) throw new Error("Invalid schedule response");
        return parseDbEvents((data.events ?? []) as DbEvent[], def);
      }),
    );
    const games = [...new Map(pages.flat().map((game) => [game.id, game])).values()];
    return games.filter((game) =>
      mode === "upcoming"
        ? game.state !== "post" && dayStamp(new Date(game.startMs)) >= day
        : dayStamp(new Date(game.startMs)) === day,
    );
  }
  const calendar = ["combat", "motorsport", "golf", "tennis"].includes(def.group);
  const dates = mode === "upcoming" && calendar ? day.slice(0, 4) : day;
  const data =
    mode === "live"
      ? {
          events: await fetchLiveScoreboardEvents(
            `${SITE_BASE}/${def.path}/scoreboard`,
            dates,
            signal,
            sportsJson,
          ),
        }
      : mode === "upcoming" && !calendar
        ? {
            events: (
              await Promise.all(
                monthStamps(day, 30).map((month) =>
                  sportsJson(
                    `${SITE_BASE}/${def.path}/scoreboard?dates=${month}&limit=200`,
                    signal,
                  ),
                ),
              )
            ).flatMap((page) => (Array.isArray(page.events) ? page.events : [])),
          }
        : await sportsJson(`${SITE_BASE}/${def.path}/scoreboard?dates=${dates}&limit=200`, signal);
  if (!Array.isArray(data.events)) throw new Error("Invalid scoreboard response");
  const games = parseEvents(data.events, def);
  return mode === "upcoming"
    ? games.filter(
        (g) =>
          g.startMs >=
            new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8)).getTime() &&
          g.state !== "post",
      )
    : def.group === "tennis" && mode !== "live"
      ? games.filter((game) => isGameOnLocalDay(game, day))
      : games;
}

const SOCCER_ALIASES: Record<string, string> = {
  ...REGIONAL_SOCCER_ALIASES,
  "English Premier League": "EPL",
  LALIGA: "LALIGA",
  "Liga Portugal": "PRIMEIRA",
  "Argentine LPF": "ARG",
  "Brazil Serie A": "BRASILEIRAO",
  "Brazil Serie B": "BRASILEIRAOB",
  "Liga AUF Uruguaya": "URU",
  "Peru Liga 1": "PER",
  "Liga FUTVE": "VEN",
  "Bolivian Liga Profesional": "BOL",
  "Turkish Super Lig": "TUR",
  "Russian Premier": "RUS",
  "Italian Serie B": "SERIEB",
  "Keuken Kampioen Divisie": "EERSTE",
  "LALIGA 2": "LALIGA2",
  "Swedish Allsvenskan": "SWE",
  "Norwegian Eliteserien": "NOR",
  "Japanese J1 League": "JLEAGUE",
  "Liga de Expansión MX": "LIGAEXP",
  "South African Premier": "RSA",
  "Liga FPD": "CRC",
  "Salvadoran Primera": "SLV",
  "NCAAM Soccer": "NCAAMSOCCER",
  "NCAAW Soccer": "NCAAWSOCCER",
};
/** ESPN's aggregate soccer board replaces dozens of competing per-league requests. */
export function parseSoccerBoard(events: unknown[]): SportsGame[] {
  return events.flatMap((raw) => {
    const event = raw as { competitions?: { altGameNote?: string }[] };
    const name = event.competitions?.[0]?.altGameNote?.split(",")[0] ?? "";
    const def =
      LEAGUES.find((l) => l.key === SOCCER_ALIASES[name]) ??
      LEAGUES.find((l) => l.group === "soccer" && l.labelEn.toLowerCase() === name.toLowerCase());
    return def ? parseEvents([raw], def) : [];
  });
}
