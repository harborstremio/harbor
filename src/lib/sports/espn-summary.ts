import { publishedScore, publishedScoreDetail } from "./score-detail";
import { toSide } from "./espn-parse";
import { safeFetch } from "@/lib/safe-fetch";
import type {
  LeagueDef,
  MatchEvent,
  MatchPlayer,
  MatchTeamStats,
  SportsGame,
  SportsMatchDetail,
  SportsSide,
} from "./espn-types";
import { SITE_BASE, leagueByTag } from "./espn-leagues";
import { fetchCombatSummary } from "./espn-summary-combat";
import { fetchTennisSummary } from "./espn-summary-tennis";
import { parseEspnVolleyballSets } from "./event-enrichment";
import { parseBaseballSituation } from "./baseball";
import { parseFootballEvents, parseFootballSituation } from "./football-situation";
import {
  parseCricketPartnerships,
  parseCricketPlayerTables,
  parsePlayerStatTables,
  parseTeamStatRows,
} from "./match-boxscore";

const FIELD_SUMMARY_GROUPS = new Set([
  "motorsport",
  "golf",
  "cycling",
  "swimming",
  "athletics",
]);

function headerSide(c: any, group: string): SportsSide {
  return {
    ...publishedScoreDetail(c, group),
    id: String(c.team?.id ?? ""),
    name: c.team?.displayName || "",
    abbr: c.team?.abbreviation || "",
    logo: c.team?.logos?.[0]?.href || "",
    score: publishedScore(c.score),
    winner: c.winner === true,
  };
}

function parseRoster(rData: any): MatchPlayer[] {
  if (!rData || !Array.isArray(rData.roster)) return [];
  return rData.roster
    .filter((p: any) => p && typeof p === "object")
    .map((p: any) => {
      const stats = Array.isArray(p.stats) ? p.stats : [];
      const getStat = (name: string) => stats.find((s: any) => s?.name === name)?.value || 0;
      const place = Number(p.formationPlace);
      return {
        id: String(p.athlete?.id ?? ""),
        name: p.athlete?.displayName || "",
        jersey: p.jersey || p.athlete?.jersey || "",
        position:
          p.position?.abbreviation ||
          p.athlete?.position?.abbreviation ||
          p.athlete?.position?.name ||
          "",
        starter: p.starter === true,
        active: typeof p.active === "boolean" ? p.active : undefined,
        batOrder: Number(p.batOrder) > 0 ? Number(p.batOrder) : undefined,
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
    return "—";
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

async function fetchTeamSummary(
  def: LeagueDef,
  eventId: string,
): Promise<SportsMatchDetail | null> {
  const res = await safeFetch(`${SITE_BASE}/${def.path}/summary?event=${eventId}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseTeamSummary(def, eventId, data);
}

export function parseTeamSummary(
  def: LeagueDef,
  eventId: string,
  data: any,
): SportsMatchDetail | null {
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
    home: headerSide(homeHeader, def.group),
    away: headerSide(awayHeader, def.group),
    startMs: Date.parse(header.date) || 0,
  };

  const field =
    FIELD_SUMMARY_GROUPS.has(def.group) && teams.length > 2
      ? teams.map((competitor: any) => toSide(competitor, def.group))
      : undefined;

  const rosters = data.rosters || [];
  const homeRosterData = rosters.find(
    (r: any) => r.homeAway === "home" || r.team?.id === homeHeader.team?.id,
  );
  const awayRosterData = rosters.find(
    (r: any) => r.homeAway === "away" || r.team?.id === awayHeader.team?.id,
  );

  const boxscoreTeams = data.boxscore?.teams || [];
  const homeBox = boxscoreTeams.find((t: any) => t.team?.id === homeHeader.team?.id);
  const awayBox = boxscoreTeams.find((t: any) => t.team?.id === awayHeader.team?.id);

  const rosterFor = (roster: any, teamId: string): MatchPlayer[] => {
    const players = parseRoster(roster);
    // Some feeds provide the participating athletes only in the box score.
    const playerBox = data.boxscore?.players?.find(
      (row: any) => String(row.team?.id) === String(teamId),
    );
    const extra = parseRoster({
      roster: (playerBox?.statistics ?? []).flatMap((row: any) => row.athletes ?? []),
    });
    const byId = new Map(players.map((player) => [player.id, player]));
    for (const player of extra) {
      if (!player.id) continue;
      const existing = byId.get(player.id);
      if (!existing) byId.set(player.id, player);
      else if (["basketball", "hockey"].includes(def.group))
        byId.set(player.id, {
          ...existing,
          starter: player.starter,
          active: player.active ?? existing.active,
          position: player.position || existing.position,
          image: player.image || existing.image,
        });
    }
    return [...byId.values()];
  };

  const homeRoster = rosterFor(homeRosterData, homeHeader.team?.id);
  const awayRoster = rosterFor(awayRosterData, awayHeader.team?.id);
  return {
    ...game,
    ...(field ? { field } : {}),
    baseball: def.group === "baseball" ? parseBaseballSituation(data.situation) : undefined,
    football: def.group === "football" ? parseFootballSituation(data) : undefined,
    homeFormation: homeRosterData?.formation,
    awayFormation: awayRosterData?.formation,
    homeRoster,
    awayRoster,
    homeStats: parseStats(homeBox),
    awayStats: parseStats(awayBox),
    allStats: [
      ...(def.group === "volleyball" ? parseEspnVolleyballSets(data, eventId) : []),
      ...parseTeamStatRows(homeBox, awayBox),
    ],
    partnerships:
      def.group === "cricket" ? parseCricketPartnerships(data, [game.home, game.away]) : undefined,
    playerStats:
      def.group === "cricket"
        ? parseCricketPlayerTables(data, [
            { side: game.home, roster: homeRoster },
            { side: game.away, roster: awayRoster },
          ])
        : parsePlayerStatTables(data.boxscore),
    events:
      def.group === "football" ? parseFootballEvents(data) : parseKeyEvents(data.keyEvents || []),
  };
}

export async function fetchMatchSummary(
  leagueTag: string,
  eventId: string,
  startMs?: number,
): Promise<SportsMatchDetail | null> {
  const def = leagueByTag(leagueTag);
  if (!def) return null;
  if (def.group === "combat") return fetchCombatSummary(def, eventId, startMs);
  if (def.group === "tennis" && eventId.includes("|"))
    return fetchTennisSummary(def, eventId, startMs);
  return fetchTeamSummary(def, eventId);
}
