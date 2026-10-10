import snapshot from "./audience-chart-snapshot.json" with { type: "json" };
import { launcherSceneArtwork, launcherTitleLogo } from "./launcher-title-art";
import type { GameSummary } from "./types";

export type AudienceBoard = "pc" | "console" | "steam" | "xbox" | "deck";
export type AudienceGame = GameSummary & { chartRank: number; hero?: string; logo?: string; description?: string; sourceUrl?: string; openGame?: GameSummary };
/** Published monthly positions, not an inferred worldwide concurrent-player ranking. */
export const AUDIENCE_REPORT = {
  month: "2026-08-01", published: "2026-09-28",
  url: "https://newzoo.com/articles/august-2026-pc-console-rankings",
  markets: 37, excludes: ["China", "India"],
} as const;

// Transcribed from the source's two MAU charts. Preserve their order and cohort.
const positions = {
  pc: ["242408", "135400", "1905", "17269", "115", "3212", "126459", "2963", "11198", "125174"],
  console: ["1905", "353848", "17269", "1020", "hq", "135400", "11198", "1122", "7360", "353901"],
} as const;
export function audienceChart(board: "pc" | "console"): AudienceGame[] {
  return positions[board].map((key, index) => {
    const game: GameSummary & { hero?: string; description?: string } = snapshot[key];
    return { ...game, id: board === "pc" && game.steamId ? `steam:${game.steamId}` : game.id, chartRank: index + 1,
      // Keep verified provider artwork as the fallback; current Steam filenames may be hashed.
      capsule: game.capsule,
      hero: game.steamId ? launcherSceneArtwork(game.igdbId) ?? game.hero : game.hero,
      logo: launcherTitleLogo(game.igdbId),
      ...(key === "hq" ? { name: "Call of Duty" } : {}) };
  });
}

/** Overlap the final page so ten published positions still fill a six-game layout. */
export function audiencePage<T>(games: readonly T[], page: number, size = 6): T[] {
  const current = Math.max(0, Math.min(Math.floor(page), Math.ceil(games.length / size) - 1));
  const start = Math.min(current * size, Math.max(0, games.length - size));
  return games.slice(start, start + size);
}
