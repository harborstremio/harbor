import type { AtlasGame } from "./igdb-data";
import type { GameSummary } from "./types";
import { isLauncherGameId, launcherCatalogSteamId } from "./launchers";

export const LAUNCHER_CATALOG_LIMIT = 50;

/** Exact GOG IDs or publisher-provided Steam associations; never infer from a game title. */
export function launcherCatalogLookup(id: string, catalogSteamId?: number): { source: number; uid: string } | undefined {
  const steam = launcherCatalogSteamId(id, catalogSteamId);
  return isLauncherGameId(id) && id.startsWith("gog:") ? { source: 5, uid: id.slice(4) }
    : steam ? { source: 1, uid: String(steam) } : undefined;
}

export function matchesLauncherCatalog(game: GameSummary, metadata: AtlasGame): boolean {
  const lookup = launcherCatalogLookup(game.id, game.catalogSteamId);
  return !!lookup && (!game.igdbId || metadata.igdbId === game.igdbId)
    && metadata.platformLinks.some(platform => platform.id === 6)
    && !!metadata.externalIds?.some(id => id.source === lookup.source && id.uid === lookup.uid);
}

export function chooseLauncherCatalog(game: GameSummary, rows: AtlasGame[]): AtlasGame | null {
  // A full unpaged result or several matching editions is insufficient evidence.
  if (rows.length >= LAUNCHER_CATALOG_LIMIT) return null;
  const matches = new Map(rows.filter(row => matchesLauncherCatalog(game, row)).map(row => [row.igdbId, row]));
  return matches.size === 1 ? [...matches.values()][0]! : null;
}
