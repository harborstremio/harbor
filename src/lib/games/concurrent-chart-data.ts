import type { GameSummary } from "./types";

export type ConcurrentRank = { appId: number; rank: number; currentPlayers: number };
export type ConcurrentChartGame = GameSummary & { chartRank: number; currentPlayers: number };
export type ConcurrentChart = { games: ConcurrentChartGame[]; observedAt: number; publishedAt: number };

/** One Steam observation supplies both the ordering and the displayed counts. */
export function parseConcurrentChart(raw: unknown): { ranks: ConcurrentRank[]; publishedAt: number } {
  const response = (raw as { response?: { last_update?: unknown; ranks?: unknown } } | null)?.response;
  if (!response || !Number.isSafeInteger(response.last_update) || Number(response.last_update) <= 0 || !Array.isArray(response.ranks)) throw Error("Concurrent chart unavailable");
  const seen = new Set<number>();
  const ranks = response.ranks.flatMap((value: unknown): ConcurrentRank[] => {
    if (!value || typeof value !== "object") return [];
    const { appid, rank, concurrent_in_game } = value as Record<string, unknown>;
    if (typeof appid !== "number" || !Number.isSafeInteger(appid) || appid <= 0 || appid > 0xffffffff || seen.has(appid) || typeof rank !== "number" || !Number.isSafeInteger(rank) || rank < 1 || typeof concurrent_in_game !== "number" || !Number.isSafeInteger(concurrent_in_game) || concurrent_in_game < 0) return [];
    seen.add(appid);
    return [{ appId: appid, rank, currentPlayers: concurrent_in_game }];
  }).sort((a, b) => b.currentPlayers - a.currentPlayers || a.rank - b.rank).slice(0, 100);
  if (!ranks.length) throw Error("Concurrent chart unavailable");
  return { ranks, publishedAt: Number(response.last_update) * 1000 };
}

/** Metadata requests may return app-ID order; never use that as chart order. */
export function concurrentChartGames(ranks: readonly ConcurrentRank[], games: readonly GameSummary[]): ConcurrentChartGame[] {
  const byId = new Map(games.map(game => [game.steamId, game]));
  return ranks.flatMap((rank, index) => {
    const game = byId.get(rank.appId);
    return game ? [{ ...game, chartRank: index + 1, currentPlayers: rank.currentPlayers }] : [];
  });
}
