import type { EsportsMatch } from "./esports-feeds";
import type { EsportsRankedTeam } from "./esports-rankings";

export type EsportsTeamEntry = {
  id: string;
  game: string;
  name: string;
  logo?: string;
  matches: EsportsMatch[];
  ranking?: EsportsRankedTeam;
};

/** Ranked teams lead the directory even when they have no match scheduled today. */
export function esportsTeamDirectory(
  matches: EsportsMatch[],
  ranked: EsportsRankedTeam[] = [],
): EsportsTeamEntry[] {
  const entries = new Map<string, EsportsTeamEntry>();
  for (const team of [...ranked].sort((a, b) => a.rank - b.rank)) {
    const key = `cs2:${team.id}`;
    if (!entries.has(key)) entries.set(key, { ...team, game: "cs2", matches: [], ranking: team });
  }
  for (const match of matches)
    for (const side of match.teams) {
      const key = `${match.game}:${side.id}`;
      if (!entries.has(key))
        entries.set(key, {
          id: side.id,
          game: match.game,
          name: side.name,
          logo: side.logo,
          matches: [],
        });
      const entry = entries.get(key)!;
      if (!entry.logo) entry.logo = side.logo;
      if (!entry.matches.some((item) => item.id === match.id)) entry.matches.push(match);
    }
  return [...entries.values()];
}
