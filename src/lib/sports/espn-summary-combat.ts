import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef, MatchTeamStatRow, MMAFighterProfile, SportsMatchDetail, SportsSide } from "./espn-types";
import { SITE_BASE } from "./espn-leagues";

const HEADSHOTS = "https://a.espncdn.com/i/headshots/mma/players/full";
const ATHLETES = "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/athletes";

function gameSide(c: any): SportsSide {
  return {
    id: String(c.id ?? ""),
    name: c.athlete?.displayName || "",
    abbr: c.athlete?.shortName || "",
    score: typeof c.score === "string" ? c.score : String(c.score || ""),
    winner: c.winner === true,
    logo: c.id ? `${HEADSHOTS}/${c.id}.png` : "",
  };
}

async function fetchProfile(id: string): Promise<MMAFighterProfile | undefined> {
  if (!id) return undefined;
  try {
    const r = await safeFetch(`${ATHLETES}/${id}`);
    if (!r.ok) return undefined;
    const d = await r.json();
    return {
      age: String(d.age || "-"),
      height: d.displayHeight || "-",
      weight: d.displayWeight || "-",
      reach: d.displayReach || "-",
      stance: d.stance?.text || "-",
      fullImage: d.images?.[0]?.href || `${HEADSHOTS}/${id}.png`,
    };
  } catch {
    return undefined;
  }
}

function recordRows(homeRaw: any, awayRaw: any): MatchTeamStatRow[] {
  const allStats: MatchTeamStatRow[] = [];
  const hRecords: any[] = homeRaw.records || [];
  const aRecords: any[] = awayRaw.records || [];
  for (const hr of hRecords) {
    const ar = aRecords.find((a: any) => a.name === hr.name);
    allStats.push({
      label: hr.name === "overall" ? "Overall Record" : hr.name,
      homeValue: hr.summary || "0",
      awayValue: ar?.summary || "0",
    });
  }
  return allStats;
}

export async function fetchCombatSummary(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
  let actualEventId = eventId;
  let compId = "";
  if (eventId.includes("|")) {
    [actualEventId, compId] = eventId.split("|");
  }

  const res = await safeFetch(`${SITE_BASE}/${def.path}/scoreboard`);
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

  const [homeProfile, awayProfile] = await Promise.all([
    fetchProfile(homeRaw.id),
    fetchProfile(awayRaw.id),
  ]);

  const t = comp.status?.type || {};
  return {
    id: eventId,
    league: def.tag,
    state: (t.state === "in" || t.state === "post") ? t.state : "pre",
    detail: t.shortDetail || t.detail || "",
    startMs: Date.parse(event.date || "") || 0,
    home: gameSide(homeRaw),
    away: gameSide(awayRaw),
    homeRoster: [],
    awayRoster: [],
    homeStats: {},
    awayStats: {},
    allStats: recordRows(homeRaw, awayRaw),
    events: [],
    homeProfile,
    awayProfile,
  };
}
