import { loadAtlasGame } from "./atlas";
import { loadGameDetail, loadGameHighlights } from "./catalog";
import { combineGameRatings } from "./rating-data";
import type { GameSummary } from "./types";
import { GameRequestPool } from "./request-pool";
export type { GameRating } from "./rating-data";
const pool = new GameRequestPool(2);

/** Invoke for the selected/hovered game, never every offscreen card. Existing provider pools/caches apply. */
export async function loadGameRatings(game: GameSummary, signal?: AbortSignal) {
  signal?.throwIfAborted();
  return pool.run(async () => {
  const [steam, atlas, reviews] = await Promise.allSettled([
    game.steamId ? loadGameDetail(game.steamId) : Promise.resolve(null),
    loadAtlasGame(game, signal),
    game.steamId ? loadGameHighlights([game.steamId]) : Promise.resolve([]),
  ]);
  signal?.throwIfAborted();
  const applicable = game.steamId ? [steam, atlas, reviews] : [atlas];
  if (applicable.every(result => result.status === "rejected")) throw Error("Game ratings unavailable");
  return combineGameRatings(game, steam.status === "fulfilled" ? steam.value : null, atlas.status === "fulfilled" ? atlas.value : null, reviews.status === "fulfilled" ? reviews.value.find(item => item.steamId === game.steamId) : null);
  }, signal);
}
