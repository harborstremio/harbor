import { safeFetch } from "@/lib/safe-fetch";
import { LEAGUES } from "./espn";

const BASE = "https://site.web.api.espn.com/apis/site/v2/sports";
const TTL = 300_000;

export type H2HTeam = { id: string; name: string; abbr: string; logo: string };

export type H2HSide = H2HTeam & { score: string; value: number | null; winner: boolean };

export type H2HMeeting = {
  id: string;
  startMs: number;
  state: "pre" | "in" | "post";
  detail: string;
  venue: string;
  season: string;
  home: H2HSide;
  away: H2HSide;
};

export type TeamSchedule = {
  leagueTag: string;
  team: H2HTeam;
  seasonYear: number;
  seasonLabel: string;
  events: H2HMeeting[];
};

export type HeadToHead = {
  leagueTag: string;
  teamA: H2HTeam;
  teamB: H2HTeam;
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  aScored: number;
  bScored: number;
  meetings: H2HMeeting[];
  upcoming: H2HMeeting[];
};

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

function pathForTag(leagueTag: string): string | null {
  return LEAGUES.find((l) => l.tag === leagueTag)?.path ?? null;
}

function scoreOf(raw: unknown): { score: string; value: number | null } {
  if (typeof raw === "number") return { score: String(raw), value: raw };
  if (typeof raw === "string") {
    const n = Number(raw);
    return { score: raw, value: Number.isFinite(n) ? n : null };
  }
  const o = obj(raw);
  const display = str(o.displayValue);
  const value = typeof o.value === "number" && Number.isFinite(o.value) ? o.value : null;
  if (!display && value == null) return { score: "", value: null };
  return { score: display || String(value), value };
}

function toSide(competitor: Raw): H2HSide {
  const team = obj(competitor.team);
  const logos = arr(team.logos);
  const { score, value } = scoreOf(competitor.score);
  return {
    id: str(team.id) || str(competitor.id),
    name: str(team.displayName) || str(team.name),
    abbr: str(team.abbreviation),
    logo: str(team.logo) || str(logos[0]?.href),
    score,
    value,
    winner: competitor.winner === true,
  };
}

function toMeeting(event: Raw): H2HMeeting | null {
  const comp = arr(event.competitions)[0];
  if (!comp) return null;
  const competitors = arr(comp.competitors);
  if (competitors.length < 2) return null;
  const homeRaw = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const awayRaw = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  if (!homeRaw || !awayRaw) return null;
  const type = obj(obj(comp.status).type ?? obj(event.status).type);
  const rawState = type.state;
  const venue = obj(comp.venue);
  return {
    id: str(event.id),
    startMs: Date.parse(str(comp.date) || str(event.date)) || 0,
    state: rawState === "in" || rawState === "post" ? rawState : "pre",
    detail: str(type.shortDetail) || str(type.detail) || str(type.description),
    venue: str(venue.fullName),
    season: str(obj(event.season).displayName) || str(obj(event.season).year),
    home: toSide(homeRaw),
    away: toSide(awayRaw),
  };
}

function parseSchedule(data: Raw, leagueTag: string): TeamSchedule | null {
  const team = obj(data.team);
  const id = str(team.id);
  if (!id) return null;
  const season = obj(data.requestedSeason ?? data.season);
  const events = arr(data.events)
    .map(toMeeting)
    .filter((m): m is H2HMeeting => m !== null)
    .sort((a, b) => b.startMs - a.startMs);
  return {
    leagueTag,
    team: {
      id,
      name: str(team.displayName) || str(team.name),
      abbr: str(team.abbreviation),
      logo: str(team.logo) || str(arr(team.logos)[0]?.href),
    },
    seasonYear: Number(season.year) || 0,
    seasonLabel: str(season.displayName) || str(season.name) || str(season.year),
    events,
  };
}

const cache = new Map<string, { at: number; schedule: TeamSchedule | null }>();
const inflight = new Map<string, Promise<TeamSchedule | null>>();

async function fetchTeamScheduleRaw(
  leagueTag: string,
  teamId: string,
  season?: number,
): Promise<TeamSchedule | null> {
  const path = pathForTag(leagueTag);
  if (!path || !teamId) return null;
  const query = season ? `?season=${season}` : "";
  const res = await safeFetch(`${BASE}/${path}/teams/${teamId}/schedule${query}`);
  if (!res.ok) return null;
  const data = (await res.json()) as Raw;
  return parseSchedule(data, leagueTag);
}

export function fetchTeamSchedule(
  leagueTag: string,
  teamId: string,
  season?: number,
): Promise<TeamSchedule | null> {
  const key = season ? `${leagueTag}:${teamId}@${season}` : `${leagueTag}:${teamId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.schedule);
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetchTeamScheduleRaw(leagueTag, teamId, season)
    .then((schedule) => {
      cache.set(key, { at: Date.now(), schedule });
      return schedule;
    })
    .catch(() => cache.get(key)?.schedule ?? null)
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function involves(meeting: H2HMeeting, a: string, b: string): boolean {
  const ids = [meeting.home.id, meeting.away.id];
  return ids.includes(a) && ids.includes(b);
}

function sideFor(meeting: H2HMeeting, teamId: string): H2HSide | null {
  if (meeting.home.id === teamId) return meeting.home;
  if (meeting.away.id === teamId) return meeting.away;
  return null;
}

export async function fetchHeadToHead(
  leagueTag: string,
  teamAId: string,
  teamBId: string,
  seasons = 3,
): Promise<HeadToHead | null> {
  if (!teamAId || !teamBId || teamAId === teamBId) return null;
  const current = await fetchTeamSchedule(leagueTag, teamAId);
  if (!current) return null;

  const back = Math.max(0, seasons - 1);
  const years: number[] = [];
  for (let i = 1; i <= back && current.seasonYear > 0; i++) years.push(current.seasonYear - i);
  const older = await Promise.all(
    years.map((y) => fetchTeamSchedule(leagueTag, teamAId, y).catch(() => null)),
  );

  const byId = new Map<string, H2HMeeting>();
  for (const schedule of [current, ...older]) {
    if (!schedule) continue;
    for (const meeting of schedule.events) {
      if (!meeting.id || byId.has(meeting.id)) continue;
      if (!involves(meeting, teamAId, teamBId)) continue;
      byId.set(meeting.id, meeting);
    }
  }

  const all = [...byId.values()].sort((a, b) => b.startMs - a.startMs);
  const meetings = all.filter((m) => m.state === "post");
  const upcoming = all.filter((m) => m.state !== "post").sort((a, b) => a.startMs - b.startMs);

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let aScored = 0;
  let bScored = 0;
  let teamB: H2HTeam | null = null;

  for (const meeting of all) {
    const sideB = sideFor(meeting, teamBId);
    if (sideB && !teamB) teamB = { id: sideB.id, name: sideB.name, abbr: sideB.abbr, logo: sideB.logo };
    if (meeting.state !== "post") continue;
    const sideA = sideFor(meeting, teamAId);
    if (!sideA || !sideB) continue;
    if (sideA.value != null) aScored += sideA.value;
    if (sideB.value != null) bScored += sideB.value;
    if (sideA.winner) aWins += 1;
    else if (sideB.winner) bWins += 1;
    else if (sideA.value != null && sideB.value != null) {
      if (sideA.value > sideB.value) aWins += 1;
      else if (sideB.value > sideA.value) bWins += 1;
      else draws += 1;
    } else draws += 1;
  }

  if (!teamB) {
    const other = await fetchTeamSchedule(leagueTag, teamBId).catch(() => null);
    if (other) teamB = other.team;
  }

  return {
    leagueTag,
    teamA: current.team,
    teamB: teamB ?? { id: teamBId, name: "", abbr: "", logo: "" },
    played: meetings.length,
    aWins,
    bWins,
    draws,
    aScored,
    bScored,
    meetings,
    upcoming,
  };
}
