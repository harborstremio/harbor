import type { EsportsMatch } from "./esports-feeds";
import type { SportsGame } from "./espn-types";

/** Use match identity so reminders for two games in one tournament remain independent. */
export function esportsSportsGame(match: EsportsMatch): SportsGame {
  const side = (index: number) => ({
    id: match.teams[index].id,
    name: match.teams[index].name,
    abbr: match.teams[index].code || match.teams[index].name,
    logo: match.teams[index].logo || "",
    score: match.teams[index].score?.toString() || "",
    winner: match.teams[index].winner || false,
  });
  return {
    id: match.id,
    league: {
      dota2: "DOTA2",
      lol: "LOL",
      valorant: "VALORANT",
      cs2: "CS2",
      rocketleague: "RLCS",
    }[match.game],
    source: match.game === "dota2" ? "opendota" : "esports-arena",
    state: match.state === "live" ? "in" : match.state === "recent" ? "post" : "pre",
    startMs: match.startMs,
    detail: match.event.stage || "",
    home: side(0),
    away: side(1),
    context: {
      id: match.id,
      name: match.event.name,
      round: match.event.stage || "",
      venue: "",
      draw: "",
      major: false,
    },
  };
}
