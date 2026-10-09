import type { GameHighlight } from "./catalog";
import { matchesFavoriteReviews, type FavoriteReviewFilters } from "./favorites-data";

type FavoritePage = { games: GameHighlight[]; nextOffset: number | null; cachedAt?: number };

/** Keep Steam's cursor even when every item in a page is filtered out. */
export async function collectFavoriteMatches(
  load: (offset: number) => Promise<FavoritePage>,
  offset: number,
  filters: FavoriteReviewFilters,
  signal: AbortSignal,
): Promise<FavoritePage> {
  const games: GameHighlight[] = [], seen = new Set<string>();
  let nextOffset: number | null = offset, cachedAt: number | undefined;
  // The first screen can look beyond a sparse page. Later paging is already
  // bounded by usePagedGameRow; don't multiply its three-request loop.
  const limit = offset === 0 && (filters.minCount || filters.minPositive) ? 3 : 1;
  for (let n = 0; n < limit && nextOffset !== null; n++) {
    signal.throwIfAborted();
    const cursor: number = nextOffset;
    let page: FavoritePage;
    try { page = await load(cursor); }
    catch (error) {
      signal.throwIfAborted();
      // A later page failing must not erase matches already found. Leave its
      // cursor available for the next explicit page request.
      if (games.length) break;
      throw error;
    }
    signal.throwIfAborted();
    if (page.nextOffset !== null && page.nextOffset <= cursor) throw Error("Favorites cursor did not advance");
    for (const game of page.games) if (!seen.has(game.id) && matchesFavoriteReviews(game, filters)) {
      seen.add(game.id); games.push(game);
    }
    if (page.cachedAt !== undefined) cachedAt = Math.min(cachedAt ?? Infinity, page.cachedAt);
    nextOffset = page.nextOffset;
    if (games.length >= 12) break;
  }
  return { games, nextOffset, cachedAt };
}
