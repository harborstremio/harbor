import type { CatalogFilters } from "./catalog-filters";
import { mergeGameSearchResults, type GameSearchCursor, type UnifiedGameSearchPage } from "./unified-game-search";
import { savedMetadataAt } from "./metadata-records";

/** Skip healthy providers entirely when recovering a partial page. */
export function missingSearchCursor(page: UnifiedGameSearchPage): GameSearchCursor | null {
  if (!page.searchCursor || !page.unavailable?.length) return null;
  return {
    steam: page.unavailable.includes("Steam") ? page.searchCursor.steam : null,
    igdb: page.unavailable.includes("IGDB") ? page.searchCursor.igdb : null,
  };
}

export function mergeCatalogContinuation(query: string, sort: CatalogFilters["sort"], previous: UnifiedGameSearchPage,
  page: UnifiedGameSearchPage, requested: GameSearchCursor, recovery: boolean): UnifiedGameSearchPage {
  const unified = !!previous.searchCursor;
  const games = unified ? mergeGameSearchResults(query, [...previous.games, ...page.games], sort)
    : [...new Map([...previous.games, ...page.games].map(game => [game.id, game])).values()];
  if (!unified || !page.searchCursor) return { ...page, games, cachedAt: savedMetadataAt([previous, page]) };
  const searchCursor = recovery ? {
    steam: requested.steam === null ? previous.searchCursor!.steam : page.searchCursor.steam,
    igdb: requested.igdb === null ? previous.searchCursor!.igdb : page.searchCursor.igdb,
  } : page.searchCursor;
  const unavailable = [...new Set([
    ...(recovery ? (previous.unavailable ?? []).filter(provider => requested[provider === "Steam" ? "steam" : "igdb"] === null) : []),
    ...(page.unavailable ?? []),
  ])];
  const offsets = [searchCursor.steam, searchCursor.igdb].filter((value): value is number => value !== null);
  return { ...page, games, total: games.length, searchCursor, unavailable,
    nextOffset: offsets.length ? Math.max(...offsets) : null, cachedAt: savedMetadataAt([previous, page]) };
}
