import type { SportsGame } from "@/lib/sports/espn-types";
import { ESPORTS_GAMES } from "@/lib/sports/esports-catalog";
import { esportsRailGames } from "@/lib/sports/esports-match-rail";
import { hubLeague } from "@/lib/sports/hub-data";

const SCENERY_GROUPS = new Set([
  "soccer",
  "football",
  "basketball",
  "baseball",
  "hockey",
  "combat",
  "boxing",
  "motorsport",
  "tennis",
  "golf",
  "rugby",
  "cricket",
  "aussie",
  "lacrosse",
  "esports",
  "volleyball",
  "handball",
  "badminton",
  "tabletennis",
  "snooker",
  "darts",
  "netball",
  "fieldhockey",
  "cycling",
  "winter",
  "athletics",
  "softball",
]);

const SCENERY_VERSION: Readonly<Record<string, string>> = {
  combat: "arena-1",
  basketball: "court-1",
  soccer: "pitch-1",
};

const SINGLE_SUBJECT = new Set(["combat", "boxing", "esports", "golf", "motorsport"]);

export function bpSportsGroup(game: SportsGame | null | undefined): string {
  if (!game) return "";
  return hubLeague(game.league)?.group || "other";
}

export function bpSportsSingleSubject(game: SportsGame): boolean {
  return !!game.context?.name && (!game.away.name || SINGLE_SUBJECT.has(bpSportsGroup(game)));
}

export function bpSportsScenery(group: string, leagueTag?: string): string {
  if (group === "esports" && leagueTag) {
    const id = esportsRailGames([leagueTag])?.[0];
    const art = id ? ESPORTS_GAMES.find((entry) => entry.id === id)?.art : undefined;
    if (art) return art;
  }
  const photo = SCENERY_GROUPS.has(group) ? group : "soccer";
  return `/sports/hero-photos/${photo}.webp?v=${SCENERY_VERSION[photo] ?? "venue-2"}`;
}

function bpSportsGameScenery(game: SportsGame): string {
  return bpSportsScenery(bpSportsGroup(game), game.league);
}

export function bpSportsCardArt(game: SportsGame): string | undefined {
  if (!bpSportsSingleSubject(game)) return undefined;
  return game.artwork || game.poster || bpSportsGameScenery(game);
}
