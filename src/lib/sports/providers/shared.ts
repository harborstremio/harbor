import type { SportsGame, SportsMatchDetail, SportsSide } from "../espn-types";

export type { SportsProvider } from "../provider";

const NOT_STARTED = new Set(["", "NS", "TBD", "NOT STARTED", "SCHEDULED"]);
const FINISHED = new Set(["FT", "AET", "PEN", "AOT", "AP", "AWD", "AW", "WO", "MATCH FINISHED", "FINISHED"]);
const VOID = new Set(["PST", "POST", "CANC", "ABD", "SUSP", "POSTPONED", "CANCELLED", "ABANDONED"]);
const CLOCKED = new Set(["1H", "2H", "ET", "LIVE"]);
const DETAIL: Record<string, string> = {
  FT: "",
  AET: "AET",
  PEN: "PEN",
  AOT: "OT",
  AP: "SO",
  PT: "SO",
  P: "PEN",
  BT: "BT",
  HT: "HT",
  ET: "ET",
  LIVE: "",
  PST: "Postponed",
  POST: "Postponed",
  CANC: "Cancelled",
  ABD: "Abandoned",
  SUSP: "Suspended",
  INT: "Interrupted",
  INTR: "Interrupted",
  AWD: "Awarded",
  AW: "Awarded",
  WO: "Walkover",
};
const SETTLED_AFTER_MS = 3 * 3_600_000;

export function stateOf(code: string, hasScore: boolean, startMs: number): SportsGame["state"] {
  const c = code.trim().toUpperCase();
  if (FINISHED.has(c) || VOID.has(c)) return "post";
  if (!NOT_STARTED.has(c)) return "in";
  const settled = hasScore && startMs > 0 && Date.now() - startMs > SETTLED_AFTER_MS;
  return settled ? "post" : "pre";
}

export function detailOf(code: string, elapsed?: number | null, clock?: string | null): string {
  const c = code.trim().toUpperCase();
  if (NOT_STARTED.has(c)) return "";
  if (CLOCKED.has(c) && typeof elapsed === "number" && elapsed > 0) return `${elapsed}'`;
  if (c in DETAIL) return DETAIL[c];
  return clock ? `${c} ${clock}` : c;
}

export function side(
  id: unknown,
  name: unknown,
  logo: unknown,
  score: unknown,
  winner: boolean,
): SportsSide {
  return {
    id: id == null ? "" : String(id),
    name: typeof name === "string" ? name : "",
    abbr: "",
    logo: typeof logo === "string" ? logo : "",
    score: score == null ? "" : String(score),
    winner,
  };
}

export function winners(state: SportsGame["state"], home: unknown, away: unknown): [boolean, boolean] {
  if (state !== "post" || home == null || away == null) return [false, false];
  const h = Number(home);
  const a = Number(away);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return [false, false];
  return [h > a, a > h];
}

export function isoOf(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, "0")}${`${d.getDate()}`.padStart(2, "0")}`;
}

export function emptyDetail(game: SportsGame): SportsMatchDetail {
  return {
    ...game,
    homeRoster: [],
    awayRoster: [],
    homeStats: {},
    awayStats: {},
    allStats: [],
    events: [],
  };
}
