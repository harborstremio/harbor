import { queryIgdb, readIgdbSnapshot } from "./atlas";
import { DEFAULT_ATLAS_FILTERS, type AtlasFilters } from "./igdb-data";
import { FRANCHISE_INDEX_QUERY, franchiseQuery, parseFranchiseIndex, parseFranchisePage, gameWorldsQuery, parseGameWorldsPage } from "./franchise-data";
import { isKnownWarhammerMisclassification } from "./warhammer-data";
export type { GameFranchise, GameFranchisePage } from "./franchise-data";

export async function loadGameFranchises(signal?: AbortSignal) {
  return parseFranchiseIndex(await queryIgdb(FRANCHISE_INDEX_QUERY, signal));
}
export async function readGameFranchisesSnapshot() {
  const rows = await readIgdbSnapshot(FRANCHISE_INDEX_QUERY);
  return rows ? parseFranchiseIndex(rows) : null;
}
export async function loadGameFranchise(id: string, offset = 0, signal?: AbortSignal, filters: AtlasFilters = DEFAULT_ATLAS_FILTERS) {
  const start = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const page = parseFranchisePage(await queryIgdb(franchiseQuery(id, filters, start), signal), id, start);
  return id === "franchise:6" ? { ...page, games: page.games.filter(game => !isKnownWarhammerMisclassification(game.igdbId)) } : page;
}

export async function loadGameWorlds(offset = 0, signal?: AbortSignal) {
  return parseGameWorldsPage(await queryIgdb(gameWorldsQuery(offset), signal), offset);
}
