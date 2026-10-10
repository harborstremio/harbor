import type { GameSummary } from "./types";
import { gameIdentities } from "./recommendations";

export type RecommendationPool = { games: GameSummary[]; matches?: Record<string,string[]>; partial?: boolean; cachedAt?: number; nextOffset?: number | null };
export type SteamRecommendationPool = { games: GameSummary[]; tags: string[]; cachedAt?: number; nextOffset?: number | null };
export type RelatedRecommendationGames = GameSummary[] & { cachedAt?: number };
export function oldestRecommendationObservation(...values: (number | undefined)[]): number | undefined {
  const times=values.filter((value):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>0);
  return times.length?Math.min(...times):undefined;
}

/** Keep cross-platform provider connections among tag matches, with exact identity joins only. */
export function combineRecommendationPools(steam: PromiseSettledResult<SteamRecommendationPool>, atlas: PromiseSettledResult<RelatedRecommendationGames>): RecommendationPool {
  if (steam.status === "rejected" && atlas.status === "rejected") throw Error("Recommendation sources unavailable");
  const related: RelatedRecommendationGames = atlas.status === "fulfilled" ? atlas.value : [];
  const tagged = steam.status === "fulfilled" ? steam.value : { games: [], tags: [] };
  const games: GameSummary[] = [], seen = new Set<string>(), matches: Record<string,string[]> = {};
  const add = (game: GameSummary) => {
    if (gameIdentities(game).some(id => seen.has(id))) return;
    gameIdentities(game).forEach(id => seen.add(id)); games.push(game);
  };
  const enriched = tagged.games.map(game => {
    const peer = related.find(candidate => game.steamId && candidate.steamId === game.steamId);
    // IGDB's verified Steam alias supplies console metadata; never join by title.
    const result = peer ? { ...game, igdbId: peer.igdbId, platforms: [...new Set([...game.platforms,...peer.platforms])] } : game;
    if (tagged.tags.length === 2) matches[result.id] = tagged.tags;
    return result;
  }).sort((a,b) => Number(related.some(game=>game.steamId===b.steamId))-Number(related.some(game=>game.steamId===a.steamId)));
  const taggedIds = new Set(enriched.flatMap(gameIdentities));
  const additional = related.filter(game => !gameIdentities(game).some(id => taggedIds.has(id)));
  // Two tag matches, then a provider connection. The next stage rotates seed origins.
  for (let index=0; index<Math.max(Math.ceil(enriched.length/2),additional.length); index++) {
    if (enriched[index*2]) add(enriched[index*2]);
    if (enriched[index*2+1]) add(enriched[index*2+1]);
    if (additional[index]) add(additional[index]);
  }
  const cachedAt=oldestRecommendationObservation(tagged.cachedAt,related.cachedAt,...games.map(game=>game.cachedAt),...related.map(game=>game.cachedAt));
  return { games, matches, ...(tagged.nextOffset!==undefined?{nextOffset:tagged.nextOffset}:{}), partial: steam.status === "rejected" || atlas.status === "rejected" || cachedAt!==undefined, ...(cachedAt!==undefined?{cachedAt}:{}) };
}
