import type { SportsGame, SportsSide } from "../../sports/espn-types.ts";

/** A stored snapshot is useful, but it is not evidence that a game is still live. */
export function isCurrentLiveGame(game: SportsGame | null | undefined): boolean {
  return game?.state === "in" && game.savedAt === undefined;
}

/** Providers commonly send 0-0 before kick-off. Those zeroes are not a played score. */
export function visibleScore(game: Pick<SportsGame, "state">, side: Pick<SportsSide, "score">): string {
  return game.state === "pre" ? "" : side.score;
}

/** Length-delimited JSON avoids collisions between account IDs and local profile IDs. */
export function sportsSessionKey(userId: string | null | undefined, profileId: string): string {
  return JSON.stringify([userId ?? "local", profileId]);
}
