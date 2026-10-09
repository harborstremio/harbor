import type { SportsGame } from "./espn-types";
import type { EsportsGameId, EsportsMatch } from "./esports-feeds";
import { ESPORTS_GAMES } from "./esports-catalog";
const GAME_IDS: Record<string, EsportsGameId> = {
  DOTA2: "dota2",
  CS2: "cs2",
  CSGO: "cs2",
  LOL: "lol",
  LCK: "lol",
  LEC: "lol",
  LPL: "lol",
  VALORANT: "valorant",
  RLCS: "rocketleague",
};
export function legacyEsportsMatch(game: SportsGame): EsportsMatch | null {
  const id = GAME_IDS[game.league.toUpperCase()];
  if (!id) return null;
  const def = ESPORTS_GAMES.find((item) => item.id === id)!;
  const side = (team: SportsGame["home"]) => ({
    id: team.id,
    name: team.name,
    logo: team.logo || undefined,
    code: team.abbr,
    score:
      team.score !== "" && Number.isFinite(Number(team.score)) ? Number(team.score) : undefined,
  });
  return {
    id: game.id,
    game: id,
    startMs: game.startMs,
    state: game.state === "in" ? "live" : game.state === "post" ? "recent" : "upcoming",
    teams: [side(game.home), side(game.away)],
    event: {
      id: game.context?.id || game.id,
      name: game.context?.name || def.name,
      stage: game.context?.round,
    },
    streams: [],
    sourceUrl:
      id === "dota2" && /^\d+$/.test(game.id)
        ? `https://www.opendota.com/matches/${game.id}`
        : def.officialUrl,
  };
}
