import type { GameSummary } from "./types";

export type OfficialGameDownload = { launcher: "Riot Games" | "Battle.net"; logo: string; href: string };
/** Exact product IDs only. This opens the publisher, never executes a downloaded installer. */
export function officialGameDownload(game: Pick<GameSummary, "id">): OfficialGameDownload | null {
  if (["igdb:115", "riot:league_of_legends:live"].includes(game.id)) return { launcher: "Riot Games", logo: "/games/launchers/riot.png", href: "https://www.leagueoflegends.com/en-us/download/" };
  if (["igdb:123", "igdb:75379", "battlenet:wow", "battlenet:wow_classic", "battlenet:wow_classic_era", "battlenet:wow_classic_anniversary"].includes(game.id)) return { launcher: "Battle.net", logo: "/games/launchers/battlenet.png", href: "https://download.battle.net/en-us/?product=wow" };
  return null;
}
