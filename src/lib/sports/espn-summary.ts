import { safeFetch } from "@/lib/safe-fetch";
import type {
  LeagueDef,
  MatchEvent,
  MatchPlayer,
  MatchTeamStatRow,
  MatchTeamStats,
  SportsGame,
  SportsMatchDetail,
  SportsSide,
} from "./espn-types";
import { SITE_BASE, leagueByTag } from "./espn-leagues";
import { fetchCombatSummary } from "./espn-summary-combat";
import { fetchTennisSummary } from "./espn-summary-tennis";

function headerSide(c: any): SportsSide {
  return {
    id: String(c.team?.id ?? ""),
    name: c.team?.displayName || "",
    abbr: c.team?.abbreviation || "",
    logo: c.team?.logos?.[0]?.href || "",
    score: c.score || "",
    winner: c.winner === true,
  };
}

function parseRoster(rData: any): MatchPlayer[] {
  if (!rData || !Array.isArray(rData.roster)) return [];
  return rData.roster.map((p: any) => {
    const stats = p.stats || [];
    const getStat = (name: string) => stats.find((s: any) => s.name === name)?.value || 0;
    const place = Number(p.formationPlace);
    return {
      id: p.athlete?.id || "",
      name: p.athlete?.displayName || "",
      jersey: p.jersey || p.athlete?.jersey || "",
      position: p.position?.abbreviation || p.athlete?.position?.abbreviation || "",
      starter: p.starter === true,
      substitutedIn: p.subbedIn === true,
      substitutedOut: p.subbedOut === true,
      formationPlace: Number.isFinite(place) && place > 0 ? place : undefined,
      goals: Number(getStat("totalGoals")),
      yellowCards: Number(getStat("yellowCards")),
      redCards: Number(getStat("redCards")),
      image: p.athlete?.headshot?.href || "",
    };
  });
}

function parseStats(box: any): MatchTeamStats {
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
}

function parseKeyEvents(evs: any[]): MatchEvent[] {
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
}

function statRows(homeBox: any, awayBox: any): MatchTeamStatRow[] {
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
  return allStats;
}

async function fetchTeamSummary(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
  const res = await safeFetch(`${SITE_BASE}/${def.path}/summary?event=${eventId}`);
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
    league: def.tag,
    state,
    detail: header.status?.type?.shortDetail || header.status?.type?.detail || "",
    home: headerSide(homeHeader),
    away: headerSide(awayHeader),
    startMs: Date.parse(header.date) || 0,
  };

  const rosters = data.rosters || [];
  const homeRosterData = rosters.find((r: any) => r.homeAway === "home" || r.team?.id === homeHeader.team?.id);
  const awayRosterData = rosters.find((r: any) => r.homeAway === "away" || r.team?.id === awayHeader.team?.id);

  const boxscoreTeams = data.boxscore?.teams || [];
  const homeBox = boxscoreTeams.find((t: any) => t.team?.id === homeHeader.team?.id);
  const awayBox = boxscoreTeams.find((t: any) => t.team?.id === awayHeader.team?.id);

  return {
    ...game,
    homeFormation: homeRosterData?.formation,
    awayFormation: awayRosterData?.formation,
    homeRoster: parseRoster(homeRosterData),
    awayRoster: parseRoster(awayRosterData),
    homeStats: parseStats(homeBox),
    awayStats: parseStats(awayBox),
    allStats: statRows(homeBox, awayBox),
    events: parseKeyEvents(data.keyEvents || []),
  };
}

export async function fetchMatchSummary(leagueTag: string, eventId: string): Promise<SportsMatchDetail | null> {
  const def = leagueByTag(leagueTag);
  if (!def) return null;
  if (def.group === "combat") return fetchCombatSummary(def, eventId);
  if (def.group === "tennis" && eventId.includes("|")) return fetchTennisSummary(def, eventId);
  return fetchTeamSummary(def, eventId);
}
