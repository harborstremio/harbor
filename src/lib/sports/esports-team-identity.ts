import type { EsportsMatch } from "./esports-feeds";

/** An organization name alone does not identify its squad in another game. */
export function esportsTeamLeague(
  game: EsportsMatch["game"],
  matches: EsportsMatch[],
): string | undefined {
  if (
    game === "rocketleague" &&
    matches.some((match) => match.game === game && /\bRLCS\b/i.test(match.event.name))
  )
    return "RLCS";
  if (game !== "lol") return;
  const leagues = [
    ...new Set(
      matches
        .filter((match) => match.game === game)
        .map((match) => match.event.name.split("·")[0].trim().toUpperCase())
        .filter((name) => ["LCK", "LEC", "LPL"].includes(name)),
    ),
  ];
  return leagues.length === 1 ? leagues[0] : undefined;
}
