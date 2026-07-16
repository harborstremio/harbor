import { safeFetch } from "@/lib/safe-fetch";
import { getUiLanguage } from "@/lib/i18n";

export type SportsSide = {
  name: string;
  abbr: string;
  logo: string;
  score: string;
  winner: boolean;
};

export type SportsGame = {
  id: string;
  league: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: SportsSide;
  away: SportsSide;
  startMs: number;
};

export type MatchPlayer = {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  substitutedIn?: boolean;
  substitutedOut?: boolean;
  goals: number;
  yellowCards: number;
  redCards: number;
  image?: string;
};

export type MatchTeamStats = {
  possession?: string;
  shots?: string;
  shotsOnTarget?: string;
  corners?: string;
  fouls?: string;
  yellowCards?: string;
  redCards?: string;
};

export type MatchEvent = {
  id: string;
  time: string;
  type: "goal" | "yellow_card" | "red_card" | "substitution" | "other";
  text: string;
  teamId?: string;
  participantName?: string;
};

export type MatchTeamStatRow = {
  label: string;
  homeValue: string;
  awayValue: string;
};

export type MMAFighterProfile = {
  age: string;
  height: string;
  weight: string;
  reach: string;
  stance: string;
  fullImage: string;
};

export type SportsMatchDetail = SportsGame & {
  homeFormation?: string;
  awayFormation?: string;
  homeRoster: MatchPlayer[];
  awayRoster: MatchPlayer[];
  homeStats: MatchTeamStats;
  awayStats: MatchTeamStats;
  allStats: MatchTeamStatRow[];
  events: MatchEvent[];
  homeProfile?: MMAFighterProfile;
  awayProfile?: MMAFighterProfile;
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

export type LeagueDef = {
  key: string;
  label: string;
  labelEn: string;
  tag: string;
  path: string;
  logo: string;
  group: string;
};

/** Returns the label in the current UI language */
export function getLeagueLabel(league: LeagueDef): string {
  return getUiLanguage() === "ar" ? league.label : league.labelEn;
}

/** Returns the group label in the current UI language */
export function getGroupLabel(group: { label: string; labelEn: string }): string {
  return getUiLanguage() === "ar" ? group.label : group.labelEn;
}

const TL = "https://a.espncdn.com/i/teamlogos/leagues/500";
const LL = "https://a.espncdn.com/i/leaguelogos/soccer/500";
export const LEAGUES: LeagueDef[] = [
  // ⚽ كرة القدم
  {
    key: "ROSHN",
    label: "الدوري السعودي",
    labelEn: "Saudi Pro League",
    tag: "KSA",
    path: "soccer/ksa.1",
    logo: `${LL}/2488.png`,
    group: "soccer",
  },
  {
    key: "EPL",
    label: "الدوري الإنجليزي",
    labelEn: "Premier League",
    tag: "EPL",
    path: "soccer/eng.1",
    logo: `${LL}/23.png`,
    group: "soccer",
  },
  {
    key: "UCL",
    label: "دوري الأبطال",
    labelEn: "Champions League",
    tag: "UCL",
    path: "soccer/uefa.champions",
    logo: `${LL}/2.png`,
    group: "soccer",
  },
  {
    key: "LALIGA",
    label: "الدوري الإسباني",
    labelEn: "La Liga",
    tag: "ESP",
    path: "soccer/esp.1",
    logo: `${LL}/15.png`,
    group: "soccer",
  },
  {
    key: "SERIEA",
    label: "الدوري الإيطالي",
    labelEn: "Serie A",
    tag: "ITA",
    path: "soccer/ita.1",
    logo: `${LL}/12.png`,
    group: "soccer",
  },
  {
    key: "BUNDESLIGA",
    label: "الدوري الألماني",
    labelEn: "Bundesliga",
    tag: "GER",
    path: "soccer/ger.1",
    logo: `${LL}/10.png`,
    group: "soccer",
  },
  {
    key: "LIGUE1",
    label: "الدوري الفرنسي",
    labelEn: "Ligue 1",
    tag: "FRA",
    path: "soccer/fra.1",
    logo: `${LL}/9.png`,
    group: "soccer",
  },
  {
    key: "MLS",
    label: "دوري MLS",
    labelEn: "MLS",
    tag: "MLS",
    path: "soccer/usa.1",
    logo: `${LL}/19.png`,
    group: "soccer",
  },
  {
    key: "UEL",
    label: "الدوري الأوروبي",
    labelEn: "Europa League",
    tag: "UEL",
    path: "soccer/uefa.europa",
    logo: `${LL}/2310.png`,
    group: "soccer",
  },
  {
    key: "UECLUE",
    label: "دوري المؤتمر",
    labelEn: "Conference League",
    tag: "UECL",
    path: "soccer/uefa.europa.conf",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/20296.png",
    group: "soccer",
  },
  {
    key: "WORLDCUP",
    label: "كأس العالم",
    labelEn: "World Cup",
    tag: "WC",
    path: "soccer/fifa.world",
    logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/4.png",
    group: "soccer",
  },
  {
    key: "ARABIANGCC",
    label: "كأس آسيا / الخليج",
    labelEn: "AFC Asian Cup",
    tag: "AFC",
    path: "soccer/afc.asian.cup",
    logo: "https://a.espncdn.com/combiner/i?img=/i/leaguelogos/soccer/500/2243.png",
    group: "soccer",
  },

  // 🏀 كرة السلة
  {
    key: "NBA",
    label: "NBA",
    labelEn: "NBA",
    tag: "NBA",
    path: "basketball/nba",
    logo: `${TL}/nba.png`,
    group: "basketball",
  },
  {
    key: "NCAAB",
    label: "NCAA كرة السلة",
    labelEn: "NCAA Basketball",
    tag: "NCAA",
    path: "basketball/mens-college-basketball",
    logo: `${TL}/ncaa.png`,
    group: "basketball",
  },

  // 🏈 كرة القدم الأمريكية
  {
    key: "NFL",
    label: "NFL",
    labelEn: "NFL",
    tag: "NFL",
    path: "football/nfl",
    logo: `${TL}/nfl.png`,
    group: "football",
  },
  {
    key: "NCAAF",
    label: "NCAA أمريكية",
    labelEn: "NCAA Football",
    tag: "NCAAF",
    path: "football/college-football",
    logo: `${TL}/ncaa.png`,
    group: "football",
  },

  // ⚾ البيسبول
  {
    key: "MLB",
    label: "MLB",
    labelEn: "MLB",
    tag: "MLB",
    path: "baseball/mlb",
    logo: `${TL}/mlb.png`,
    group: "baseball",
  },

  // 🏒 الهوكي
  {
    key: "NHL",
    label: "NHL",
    labelEn: "NHL",
    tag: "NHL",
    path: "hockey/nhl",
    logo: `${TL}/nhl.png`,
    group: "hockey",
  },

  // 🥊 فنون قتالية
  {
    key: "UFC",
    label: "UFC / MMA",
    labelEn: "UFC / MMA",
    tag: "UFC",
    path: "mma/ufc",
    logo: "https://a.espncdn.com/i/teamlogos/leagues/500/ufc.png",
    group: "combat",
  },

  // 🏎 السباقات
  {
    key: "F1",
    label: "فورمولا 1",
    labelEn: "Formula 1",
    tag: "F1",
    path: "racing/f1",
    logo: "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/f1.png",
    group: "motorsport",
  },
  {
    key: "NASCAR",
    label: "NASCAR",
    labelEn: "NASCAR",
    tag: "NASCAR",
    path: "racing/nascar-premier",
    logo: "https://a.espncdn.com/combiner/i?img=/redesign/assets/img/icons/ESPN-icon-NASCAR.png",
    group: "motorsport",
  },

  // 🎾 التنس
  {
    key: "TENNIS",
    label: "التنس (ATP/WTA)",
    labelEn: "Tennis (ATP/WTA)",
    tag: "ATP",
    path: "tennis/atp",
    logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-tennis.png",
    group: "tennis",
  },

  // 🏌 الغولف
  {
    key: "PGA",
    label: "بطولة PGA",
    labelEn: "PGA Tour",
    tag: "PGA",
    path: "golf/pga",
    logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-golf.png",
    group: "golf",
  },

  // 🏉 الرغبي
  {
    key: "RUGBY",
    label: "كأس العالم للرغبي",
    labelEn: "Rugby World Cup",
    tag: "RWC",
    path: "rugby/164205",
    logo: "https://a.espncdn.com/redesign/assets/img/icons/ESPN-icon-rugby.png",
    group: "rugby",
  },
];
const BY_KEY = new Map(LEAGUES.map((l) => [l.key, l] as const));
export const DEFAULT_SPORTS_LEAGUES = ["ROSHN", "EPL", "UCL", "NBA", "NFL"];

export const LEAGUE_GROUPS: { key: string; label: string; labelEn: string; icon: string }[] = [
  { key: "soccer", label: "كرة القدم", labelEn: "Soccer", icon: "⚽" },
  { key: "basketball", label: "كرة السلة", labelEn: "Basketball", icon: "🏀" },
  { key: "football", label: "الأمريكية", labelEn: "Football", icon: "🏈" },
  { key: "baseball", label: "البيسبول", labelEn: "Baseball", icon: "⚾" },
  { key: "hockey", label: "الهوكي", labelEn: "Hockey", icon: "🏒" },
  { key: "combat", label: "فنون قتالية", labelEn: "Combat", icon: "🥊" },
  { key: "motorsport", label: "السباقات", labelEn: "Motorsport", icon: "🏎" },
  { key: "tennis", label: "التنس", labelEn: "Tennis", icon: "🎾" },
  { key: "golf", label: "الغولف", labelEn: "Golf", icon: "🏌" },
  { key: "rugby", label: "الرغبي", labelEn: "Rugby", icon: "🏉" },
];

const TTL = 10_000;
const cache = new Map<string, { at: number; games: SportsGame[] }>();
const inflight = new Map<string, Promise<SportsGame[]>>();

function toSide(c: Record<string, unknown> | undefined, group?: string): SportsSide {
  const team = (c?.team ?? {}) as Record<string, unknown>;
  // For individual-sport athletes (MMA, racing, tennis, golf)
  const athlete = (c?.athlete ?? {}) as Record<string, unknown>;
  const isAthlete = c?.type === "athlete";

  // For racing (F1, NASCAR), use order/position instead of score
  let scoreValue = typeof c?.score === "string" ? c.score : String(c?.score ?? "");
  if (!scoreValue && typeof c?.order === "number") {
    const order = c.order as number;
    // Format as 1st, 2nd, 3rd, 4th, etc.
    const suffix = order === 1 ? "st" : order === 2 ? "nd" : order === 3 ? "rd" : "th";
    scoreValue = `${order}${suffix}`;
  }

  if (isAthlete) {
    let logoUrl =
      typeof athlete.flag === "object" && athlete.flag !== null
        ? (((athlete.flag as Record<string, unknown>).href as string) ?? "")
        : "";

    if (group === "combat" && c?.id) {
      logoUrl = `https://a.espncdn.com/i/headshots/mma/players/full/${c.id}.png`;
    }

    return {
      name: (athlete.displayName as string) ?? (athlete.fullName as string) ?? "",
      abbr: (athlete.shortName as string) ?? "",
      logo: logoUrl,
      score: scoreValue,
      winner: c?.winner === true,
    };
  }
  return {
    name: (team.displayName as string) ?? (team.name as string) ?? "",
    abbr: (team.abbreviation as string) ?? "",
    logo: typeof team.logo === "string" ? team.logo : "",
    score: scoreValue,
    winner: c?.winner === true,
  };
}

async function fetchLeagueRaw(league: string): Promise<SportsGame[]> {
  const def = BY_KEY.get(league);
  if (!def) return [];
  const res = await safeFetch(`${BASE}/${def.path}/scoreboard`);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    events?: unknown[];
    leagues?: { calendar?: unknown[] }[];
  };
  const events = Array.isArray(data.events) ? data.events : [];

  if (events.length > 0) {
    return parseEvents(events, def);
  }

  // No games today — use the calendar list from the response to find
  // the most recent past matchday and fetch that specific date.
  // Calendar can be either:
  //   - string[]  (soccer, basketball, etc.)  e.g. "2025-08-28T07:00Z"
  //   - object[]  (golf, some others)          e.g. { startDate, endDate, ... }
  const rawCalendar: unknown[] = data.leagues?.[0]?.calendar ?? [];
  const nowMs = Date.now();

  const pastDates: number[] = [];
  for (const entry of rawCalendar) {
    if (typeof entry === "string") {
      const ms = Date.parse(entry);
      if (!isNaN(ms) && ms < nowMs) pastDates.push(ms);
    } else if (entry && typeof entry === "object") {
      // Golf / list-type calendars have { startDate, endDate } per tournament
      const obj = entry as Record<string, unknown>;
      const end = typeof obj.endDate === "string" ? Date.parse(obj.endDate) : NaN;
      const start = typeof obj.startDate === "string" ? Date.parse(obj.startDate) : NaN;
      const ref = !isNaN(end) ? end : !isNaN(start) ? start : NaN;
      if (!isNaN(ref) && ref < nowMs) pastDates.push(ref);
    }
  }

  if (pastDates.length > 0) {
    pastDates.sort((a, b) => b - a);

    // For leagues with very dense calendars (like Tennis with daily entries),
    // sample every few days to avoid hammering the API. Try up to 10 candidates.
    const candidates = pastDates.filter((_, i) => i === 0 || i % 3 === 0).slice(0, 10);

    for (const ms of candidates) {
      const dateStr = new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
      try {
        const r = await safeFetch(`${BASE}/${def.path}/scoreboard?dates=${dateStr}`);
        if (r.ok) {
          const d2 = (await r.json()) as { events?: unknown[] };
          const evs = Array.isArray(d2.events) ? d2.events : [];
          if (evs.length > 0) return parseEvents(evs, def);
        }
      } catch {}
    }
  }

  // Fallback: walk back day by day up to 60 days
  return fetchLeagueLastResults(def);
}

/** Fallback: walk back day by day when no calendar hint is available */
async function fetchLeagueLastResults(def: LeagueDef): Promise<SportsGame[]> {
  const now = new Date();
  for (let daysBack = 1; daysBack <= 60; daysBack++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    try {
      const r = await safeFetch(`${BASE}/${def.path}/scoreboard?dates=${dateStr}`);
      if (!r.ok) continue;
      const data = (await r.json()) as { events?: unknown[] };
      const evs = Array.isArray(data.events) ? data.events : [];
      if (evs.length > 0) return parseEvents(evs, def);
    } catch {}
  }
  return [];
}

function parseEvents(events: unknown[], def: LeagueDef): SportsGame[] {
  const out: SportsGame[] = [];
  for (const evRaw of events) {
    const ev = evRaw as Record<string, unknown>;

    // Tennis / Golf use "groupings" → each grouping has "competitions"
    // Flatten them into a single competitions list
    const groupings = ev.groupings as { competitions?: unknown[] }[] | undefined;
    const flatComps: Record<string, unknown>[] = [];
    if (Array.isArray(groupings)) {
      for (const g of groupings) {
        if (Array.isArray(g.competitions)) {
          for (const c of g.competitions) flatComps.push(c as Record<string, unknown>);
        }
      }
    }

    const directComps = (ev.competitions as Record<string, unknown>[] | undefined) ?? [];
    const allComps = flatComps.length > 0 ? flatComps : directComps;
    if (allComps.length === 0) continue;

    const compsToProcess = def.group === "combat" ? allComps : [];

    if (compsToProcess.length === 0) {
      // For multi-competition events (NASCAR, F1, Tennis), prefer featured/main event
      // For F1/NASCAR: prioritize Race > Qualifying > Sprint > Practice
      let comp = allComps.find((c) => c.featured === true);
      if (!comp && (def.key === "F1" || def.key === "NASCAR")) {
        const raceComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr === "RACE" || typeAbbr === "R" || typeAbbr?.includes("MAIN");
        });
        const qualComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr?.includes("QUAL") || typeAbbr === "Q";
        });
        const sprintComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr?.includes("SPRINT") || typeAbbr === "S";
        });
        comp = raceComp || qualComp || sprintComp || allComps[allComps.length - 1];
      } else {
        comp = comp ?? allComps[0];
      }
      if (comp) compsToProcess.push(comp);
    }

    for (const comp of compsToProcess) {
      const cs = (comp.competitors as Record<string, unknown>[] | undefined) ?? [];
      if (cs.length < 2) continue;

      // Team sports: use homeAway; individual sports (athlete type): use order 1/2
      const isAthleteType = cs.some((x) => x.type === "athlete");
      let home: Record<string, unknown> | undefined;
      let away: Record<string, unknown> | undefined;

      if (isAthleteType) {
        const sorted = [...cs].sort(
          (a, b) =>
            Number((a as Record<string, unknown>).order ?? 99) -
            Number((b as Record<string, unknown>).order ?? 99),
        );
        home = sorted[0];
        away = sorted[1];
      } else {
        home = cs.find((x) => x.homeAway === "home") ?? cs[0];
        away = cs.find((x) => x.homeAway === "away") ?? cs[1];
      }

      if (!home || !away) continue;
      const t = ((comp.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
      const rawState = t.state;
      const state = rawState === "in" || rawState === "post" ? rawState : "pre";

      // Skip TBD matchups (id < 0)
      const homeId = String((home as Record<string, unknown>).id ?? "");
      const awayId = String((away as Record<string, unknown>).id ?? "");
      if (homeId.startsWith("-") && awayId.startsWith("-")) continue;

      const idStr =
        def.group === "combat"
          ? `${ev.id}|${comp.id}`
          : String(ev.id ?? `${def.key}-${out.length}`);

      out.push({
        id: idStr,
        league: def.tag,
        state,
        detail: (t.shortDetail as string) ?? (t.detail as string) ?? "",
        home: toSide(home, def.group),
        away: toSide(away, def.group),
        startMs: Date.parse((ev.date as string) ?? "") || 0,
      });
    }
  }
  return out;
}

function fetchLeague(league: string): Promise<SportsGame[]> {
  const cached = cache.get(league);
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.games);
  const existing = inflight.get(league);
  if (existing) return existing;
  const p = fetchLeagueRaw(league)
    .then((games) => {
      cache.set(league, { at: Date.now(), games });
      return games;
    })
    .catch(() => cache.get(league)?.games ?? [])
    .finally(() => inflight.delete(league));
  inflight.set(league, p);
  return p;
}

function rank(s: SportsGame["state"]): number {
  return s === "in" ? 0 : s === "pre" ? 1 : 2;
}

export function sortGames(games: SportsGame[]): SportsGame[] {
  return games
    .slice()
    .sort(
      (a, b) =>
        rank(a.state) - rank(b.state) ||
        (a.state === "post" ? b.startMs - a.startMs : a.startMs - b.startMs),
    );
}

export function liveCount(games: SportsGame[]): number {
  return games.filter((g) => g.state === "in").length;
}

export async function fetchSports(leagues: string[]): Promise<SportsGame[]> {
  const lists = await Promise.all(
    leagues.map((l) => fetchLeague(l).catch(() => [] as SportsGame[])),
  );
  return sortGames(lists.flat());
}

export async function fetchMatchSummary(
  leagueTag: string,
  eventId: string,
): Promise<SportsMatchDetail | null> {
  const def = Array.from(BY_KEY.values()).find((l) => l.tag === leagueTag);
  if (!def) return null;

  let actualEventId = eventId;
  let compId = "";

  if (def.group === "combat" && eventId.includes("|")) {
    [actualEventId, compId] = eventId.split("|");
  }

  // MMA summary endpoint is broken, extract from scoreboard directly
  if (def.group === "combat") {
    const res = await safeFetch(`${BASE}/${def.path}/scoreboard`);
    if (!res.ok) return null;
    const data = await res.json();
    const event = data.events?.find((e: any) => e.id === actualEventId);
    const comp = event?.competitions?.find((c: any) => c.id === compId);
    if (!comp) return null;

    const cs = comp.competitors || [];
    const isAthleteType = cs.some((x: any) => x.type === "athlete");
    let homeRaw, awayRaw;
    if (isAthleteType) {
      const sorted = [...cs].sort((a: any, b: any) => (a.order || 99) - (b.order || 99));
      homeRaw = sorted[0];
      awayRaw = sorted[1];
    } else {
      homeRaw = cs[0];
      awayRaw = cs[1];
    }
    if (!homeRaw || !awayRaw) return null;

    const gameSide = (c: any) => ({
      id: c.id,
      name: c.athlete?.displayName || "",
      abbr: c.athlete?.shortName || "",
      score: typeof c.score === "string" ? c.score : String(c.score || ""),
      winner: c.winner === true,
      logo: c.id ? `https://a.espncdn.com/i/headshots/mma/players/full/${c.id}.png` : "",
    });

    const home = gameSide(homeRaw);
    const away = gameSide(awayRaw);

    // Fetch deep profiles
    const fetchProfile = async (id: string): Promise<MMAFighterProfile | undefined> => {
      if (!id) return undefined;
      try {
        const r = await safeFetch(
          `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/athletes/${id}`,
        );
        if (!r.ok) return undefined;
        const d = await r.json();
        return {
          age: String(d.age || "-"),
          height: d.displayHeight || "-",
          weight: d.displayWeight || "-",
          reach: d.displayReach || "-",
          stance: d.stance?.text || "-",
          fullImage:
            d.images?.[0]?.href || `https://a.espncdn.com/i/headshots/mma/players/full/${id}.png`,
        };
      } catch {
        return undefined;
      }
    };

    const [homeProfile, awayProfile] = await Promise.all([
      fetchProfile(homeRaw.id),
      fetchProfile(awayRaw.id),
    ]);

    const allStats: MatchTeamStatRow[] = [];
    const hRecords = homeRaw.records || [];
    const aRecords = awayRaw.records || [];
    if (hRecords.length > 0) {
      hRecords.forEach((hr: any) => {
        const ar = aRecords.find((a: any) => a.name === hr.name);
        allStats.push({
          label: hr.name === "overall" ? "Overall Record" : hr.name,
          homeValue: hr.summary || "0",
          awayValue: ar?.summary || "0",
        });
      });
    }

    const t = comp.status?.type || {};
    return {
      id: eventId,
      league: def.tag,
      state: t.state === "in" || t.state === "post" ? t.state : "pre",
      detail: t.shortDetail || t.detail || "",
      startMs: Date.parse(event.date || "") || 0,
      home,
      away,
      homeRoster: [],
      awayRoster: [],
      homeStats: {},
      awayStats: {},
      allStats,
      events: [],
      homeProfile,
      awayProfile,
    };
  }

  const res = await safeFetch(`${BASE}/${def.path}/summary?event=${actualEventId}`);
  if (!res.ok) return null;
  const data = await res.json();

  const header = data.header?.competitions?.[0] || {};
  const teams = header.competitors || [];
  const homeHeader = teams.find((t: any) => t.homeAway === "home") || teams[0];
  const awayHeader = teams.find((t: any) => t.homeAway === "away") || teams[1];

  if (!homeHeader || !awayHeader) return null;

  const tState = header.status?.type?.state;
  const state = tState === "in" || tState === "post" ? tState : "pre";

  const game: SportsGame = {
    id: eventId,
    league: leagueTag,
    state,
    detail: header.status?.type?.shortDetail || header.status?.type?.detail || "",
    home: {
      name: homeHeader.team?.displayName || "",
      abbr: homeHeader.team?.abbreviation || "",
      logo: homeHeader.team?.logos?.[0]?.href || "",
      score: homeHeader.score || "",
      winner: homeHeader.winner === true,
    },
    away: {
      name: awayHeader.team?.displayName || "",
      abbr: awayHeader.team?.abbreviation || "",
      logo: awayHeader.team?.logos?.[0]?.href || "",
      score: awayHeader.score || "",
      winner: awayHeader.winner === true,
    },
    startMs: Date.parse(header.date) || 0,
  };

  const rosters = data.rosters || [];
  const homeRosterData = rosters.find(
    (r: any) => r.homeAway === "home" || r.team?.id === homeHeader.team?.id,
  );
  const awayRosterData = rosters.find(
    (r: any) => r.homeAway === "away" || r.team?.id === awayHeader.team?.id,
  );

  const parseRoster = (rData: any): MatchPlayer[] => {
    if (!rData || !Array.isArray(rData.roster)) return [];
    return rData.roster.map((p: any) => {
      const stats = p.stats || [];
      const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;
      return {
        id: p.athlete?.id || "",
        name: p.athlete?.displayName || "",
        jersey: p.jersey || p.athlete?.jersey || "",
        position: p.position?.abbreviation || p.athlete?.position?.abbreviation || "",
        starter: p.starter === true,
        substitutedIn: p.substitutedIn === true,
        substitutedOut: p.substitutedOut === true,
        goals: Number(getStat("goals")),
        yellowCards: Number(getStat("yellowCards")),
        redCards: Number(getStat("redCards")),
        image: p.athlete?.headshot?.href || "",
      };
    });
  };

  const boxscoreTeams = data.boxscore?.teams || [];
  const homeBox = boxscoreTeams.find((t: any) => t.team?.id === homeHeader.team?.id);
  const awayBox = boxscoreTeams.find((t: any) => t.team?.id === awayHeader.team?.id);

  const parseStats = (box: any): MatchTeamStats => {
    if (!box || !Array.isArray(box.statistics)) return {};
    const stats = box.statistics;
    const getS = (names: string[]) => {
      for (const n of names) {
        const s = stats.find((x: any) => x.name === n);
        if (s && s.displayValue) return s.displayValue;
      }
      return "0";
    };
    return {
      possession: getS(["possessionPct", "possession"]),
      shots: getS(["totalShots", "shotsTotal", "shots"]),
      shotsOnTarget: getS(["shotsOnTarget", "shotsOnGoal"]),
      corners: getS(["wonCorners", "corners", "cornerKicks"]),
      fouls: getS(["foulsCommitted", "fouls"]),
      yellowCards: getS(["yellowCards", "totalYellowCards"]),
      redCards: getS(["redCards", "totalRedCards"]),
    };
  };

  const keyEvents = data.keyEvents || [];
  const parseEvents = (evs: any[]): MatchEvent[] => {
    return evs.map((e: any) => {
      const txt = e.type?.text?.toLowerCase() || "";
      let type: MatchEvent["type"] = "other";
      if (txt.includes("goal")) type = "goal";
      else if (txt.includes("yellow")) type = "yellow_card";
      else if (txt.includes("red")) type = "red_card";
      else if (txt.includes("substitution")) type = "substitution";

      return {
        id: e.id || "",
        time: e.clock?.displayValue || "",
        type,
        text: e.shortText || e.text || "",
        teamId: e.team?.id,
        participantName: e.participants?.[0]?.athlete?.displayName,
      };
    });
  };

  const allStats: MatchTeamStatRow[] = [];

  const processStatItem = (hStat: any, aStatsList: any[]) => {
    if (Array.isArray(hStat.stats)) {
      const aCat = aStatsList?.find((s: any) => s.name === hStat.name);
      for (const subH of hStat.stats) {
        processStatItem(subH, Array.isArray(aCat?.stats) ? aCat.stats : []);
      }
      return;
    }

    if (!hStat.name) return;
    const name = hStat.name;
    const label = hStat.label || hStat.displayName || hStat.name;
    const hVal = hStat.displayValue || "0";

    const aStat = aStatsList?.find((s: any) => s.name === name);
    const aVal = aStat?.displayValue || "0";

    allStats.push({ label, homeValue: hVal, awayValue: aVal });
  };

  if (homeBox && Array.isArray(homeBox.statistics)) {
    for (const hStat of homeBox.statistics) {
      processStatItem(hStat, awayBox?.statistics || []);
    }
  }

  return {
    ...game,
    homeFormation: homeRosterData?.formation,
    awayFormation: awayRosterData?.formation,
    homeRoster: parseRoster(homeRosterData),
    awayRoster: parseRoster(awayRosterData),
    homeStats: parseStats(homeBox),
    awayStats: parseStats(awayBox),
    allStats,
    events: parseEvents(keyEvents),
  };
}
