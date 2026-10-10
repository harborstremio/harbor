import type { UnifiedLibraryGame } from "./unified-library";
import type { GameSummary } from "./types";
import type { GameTransfer } from "./transfers";
import type { GameTorrent } from "./torrents";
import type { SourceRelease } from "./sources";
import { sourceTransfer } from "./source-transfer-state";

export type GameAvailability = "installed" | "library" | "downloaded" | "downloading" | "paused";
const priority: Record<GameAvailability, number> = { library: 1, downloaded: 2, paused: 3, downloading: 4, installed: 5 };
function best(a?: GameAvailability, b?: GameAvailability): GameAvailability | undefined {
  return !a ? b : !b ? a : priority[a] >= priority[b] ? a : b;
}
export function availabilityKeys(game: GameSummary): string[] {
  const keys = [game.id];
  if (game.steamId) keys.push("steam:" + game.steamId);
  if (game.igdbId) keys.push("igdb:" + game.igdbId);
  if (game.catalogSteamId) keys.push("steam:" + game.catalogSteamId);
  return [...new Set(keys)];
}
export function transferAvailability(status: string): GameAvailability | undefined {
  if (status === "complete") return "downloaded";
  if (status === "paused" || status === "pausing") return "paused";
  if (["queued", "connecting", "retrying", "downloading", "checking"].includes(status)) return "downloading";
}
/** Catalog identities only: a saved wishlist or a similar title is not ownership. */
export function gameAvailabilityIndex(profile: string, library: readonly UnifiedLibraryGame[], transfers: readonly GameTransfer[], torrents: readonly GameTorrent[]): Map<string, GameAvailability> {
  const index = new Map<string, GameAvailability>();
  const add = (key: string, value: GameAvailability) => index.set(key, best(index.get(key), value)!);
  for (const entry of library) {
    const status = entry.state === "ready" && entry.source !== "retro" ? "installed" : "library";
    for (const key of entry.game ? availabilityKeys(entry.game) : [entry.id]) add(key, status);
  }
  for (const record of [...transfers, ...torrents]) {
    const status = transferAvailability(record.status);
    if (record.profile === profile && record.game?.id && status) add(record.game.id, status);
  }
  return index;
}
export function gameAvailability(index: ReadonlyMap<string, GameAvailability>, game?: GameSummary): GameAvailability | undefined {
  return game ? availabilityKeys(game).reduce<GameAvailability | undefined>((status, key) => best(status, index.get(key)), undefined) : undefined;
}
/** Exact URL/infohash also recognizes older downloads made before catalog context was saved. */
export function releaseAvailability(release: SourceRelease, profile: string, transfers: GameTransfer[], torrents: GameTorrent[], known?: GameAvailability): GameAvailability | undefined {
  return release.files.reduce<GameAvailability | undefined>((state, file) => best(state, transferAvailability(sourceTransfer(file, torrents.filter(item => item.profile === profile), transfers.filter(item => item.profile === profile))?.status ?? "")), known);
}
