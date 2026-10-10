import type { SportCategory } from "./sports-channels.ts";

/**
 * Which channel sport a league's games belong to, so a sport's card on Live Sports Channels can
 * wear the art of a team the viewer follows in that sport. Plain module, no I/O.
 */
const LEAGUE_SPORT: Record<string, SportCategory> = {
  NFL: "football",
  NCAAF: "football",
  NBA: "basketball",
  WNBA: "basketball",
  NCAAB: "basketball",
  NCAA: "basketball",
  NCAAW: "basketball",
  MLB: "baseball",
  NHL: "hockey",
  EPL: "soccer",
  MLS: "soccer",
  UCL: "soccer",
  NWSL: "soccer",
  UFC: "combat",
  F1: "racing",
  NASCAR: "racing",
  PGA: "golf-tennis",
  ATP: "golf-tennis",
  WTA: "golf-tennis",
};

const COLLEGE = new Set(["NCAAF", "NCAAB", "NCAA", "NCAAW"]);

export function leagueSport(league: string): SportCategory | null {
  return LEAGUE_SPORT[league.toUpperCase()] ?? null;
}

/** True when a league's teams belong on a card for this sport ("college" takes NCAA leagues). */
export function leagueFitsSport(league: string, sport: SportCategory): boolean {
  if (sport === "college") return COLLEGE.has(league.toUpperCase());
  return leagueSport(league) === sport;
}

/** Harbor's bundled sport photo group for a channel sport. */
export const SPORT_SCENERY: Record<SportCategory, string> = {
  football: "football",
  basketball: "basketball",
  baseball: "baseball",
  hockey: "hockey",
  soccer: "soccer",
  combat: "combat",
  college: "football",
  racing: "motorsport",
  "golf-tennis": "golf",
  other: "soccer",
};

/** "NCAAF 03" → "NCAAF": an event slot's league part. */
export function slotLeague(slot: string | null): string | null {
  const name = slot?.replace(/[\s#:-]*\d+$/, "").trim();
  return name || null;
}

const LOGO_PATH: Record<string, string> = {
  NFL: "nfl",
  NBA: "nba",
  WNBA: "wnba",
  MLB: "mlb",
  NHL: "nhl",
  NCAAF: "ncaa",
  NCAAB: "ncaa",
  NCAA: "ncaa",
  NCAAW: "ncaa",
  EPL: "soccer",
  MLS: "soccer",
  UCL: "soccer",
};

/** ESPN's logo for a team id in a league, when the league has one. */
export function espnTeamLogo(league: string, id: string): string | null {
  const path = LOGO_PATH[league.toUpperCase()];
  if (!path || !/^\d{1,10}$/.test(id)) return null;
  return `https://a.espncdn.com/i/teamlogos/${path}/500/${id}.png`;
}
