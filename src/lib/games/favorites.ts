import { loadGameCatalog, loadGameHighlights, readGameCatalogSnapshot, readGameHighlightsSnapshot } from "./catalog";
import { CATALOG_PAGE_SIZE } from "./catalog-filters";
import { AAA_FAVORITE_IDS, DEFAULT_FAVORITE_REVIEWS, favoriteCatalogFilters, matchesFavoriteReviews, rankAAAFavorites, type FavoriteReviewFilters, type GameFavoriteFilter } from "./favorites-data";
import { collectFavoriteMatches } from "./favorites-pages";
import { savedMetadataAt } from "./metadata-records";

export async function readGameFavoritesSnapshot(filter: GameFavoriteFilter, reviews: FavoriteReviewFilters = DEFAULT_FAVORITE_REVIEWS) {
  if (filter === 'aaa') {
    const batches=await Promise.all(Array.from({length:Math.ceil(AAA_FAVORITE_IDS.length/24)},(_,i)=>readGameHighlightsSnapshot(AAA_FAVORITE_IDS.slice(i*24,(i+1)*24))));
    if (batches.some(batch=>!batch)) return null;
    const games=rankAAAFavorites(batches.flatMap(batch=>batch??[])).filter(game=>matchesFavoriteReviews(game,reviews));
    return {games:games.slice(0,CATALOG_PAGE_SIZE),nextOffset:games.length>CATALOG_PAGE_SIZE?CATALOG_PAGE_SIZE:null,cachedAt:savedMetadataAt(batches)};
  }
  const page=await readGameCatalogSnapshot('',favoriteCatalogFilters(filter));
  if (!page) return null;
  const ids=page.games.flatMap(game=>game.steamId?[game.steamId]:[]);
  const batches=await Promise.all([readGameHighlightsSnapshot(ids.slice(0,24)),readGameHighlightsSnapshot(ids.slice(24))]);
  const details=new Map(batches.flatMap(batch=>batch??[]).map(game=>[game.id,game]));
  return {...page,games:page.games.map(game=>({...game,...details.get(game.id)})).filter(game=>matchesFavoriteReviews(game,reviews)),cachedAt:savedMetadataAt([page,...batches])};
}

export async function loadGameFavorites(filter: GameFavoriteFilter, offset: number, signal: AbortSignal, reviews: FavoriteReviewFilters = DEFAULT_FAVORITE_REVIEWS) {
  signal.throwIfAborted();
  if (filter === "aaa") {
    const batches = await Promise.all(Array.from({ length: Math.ceil(AAA_FAVORITE_IDS.length / 24) }, (_, i) => loadGameHighlights(AAA_FAVORITE_IDS.slice(i * 24, (i + 1) * 24))));
    signal.throwIfAborted();
    const games = rankAAAFavorites(batches.flat()).filter(game=>matchesFavoriteReviews(game,reviews));
    return { games: games.slice(offset, offset + CATALOG_PAGE_SIZE), nextOffset: offset + CATALOG_PAGE_SIZE < games.length ? offset + CATALOG_PAGE_SIZE : null, cachedAt: savedMetadataAt(batches) };
  }
  return collectFavoriteMatches(async cursor => {
  const page = await loadGameCatalog("", favoriteCatalogFilters(filter), cursor, signal);
  signal.throwIfAborted();
  const ids = page.games.flatMap(game => game.steamId ? [game.steamId] : []);
  const batches = await Promise.all([loadGameHighlights(ids.slice(0, 24)), loadGameHighlights(ids.slice(24))]);
  signal.throwIfAborted();
  const details = new Map(batches.flat().map(game => [game.id, game]));
  return { ...page, games: page.games.map(game => ({ ...game, ...details.get(game.id) })), cachedAt: savedMetadataAt([page, ...batches]) };
  }, offset, reviews, signal);
}
