import { loadAtlasGame } from "./atlas";
import { loadGameCatalog, loadRecommendationTagNames, loadRecommendationTagProfile } from "./catalog";
import { DEFAULT_CATALOG_FILTERS } from "./catalog-filters";
import { combineRecommendationPools, oldestRecommendationObservation, type RecommendationPool, type SteamRecommendationPool } from "./recommendation-pool";
import { recommendationTagPair } from "./recommendation-tags";
import type { GameSummary } from "./types";
import { savedMetadataAt } from "./metadata-records";
import { settleRecommendationSources } from "./recommendation-load";

async function steamConnections(game: GameSummary, language: string, signal?: AbortSignal, offset=0): Promise<SteamRecommendationPool> {
  if (!game.steamId) return { games: [], tags: [], nextOffset: null };
  const [profile,names] = await Promise.all([loadRecommendationTagProfile(game.steamId,signal),loadRecommendationTagNames(language)]);
  signal?.throwIfAborted();
  const pair = recommendationTagPair(profile,names);
  const evidenceAt=oldestRecommendationObservation(savedMetadataAt(profile),savedMetadataAt(names));
  if (!pair.length) return { games: [], tags: [], cachedAt:evidenceAt, nextOffset: null };
  const page = await loadGameCatalog("",{...DEFAULT_CATALOG_FILTERS,tags:pair.map(tag=>tag.id)},offset,signal);
  const cachedAt=oldestRecommendationObservation(evidenceAt,savedMetadataAt(page));
  return { games: page.games, tags: pair.map(tag=>tag.name), cachedAt, nextOffset: page.nextOffset };
}

export async function loadRecommendationGames(game: GameSummary, signal?: AbortSignal, language="en", offset=0): Promise<RecommendationPool> {
  const [steam,atlas] = await settleRecommendationSources(
    sourceSignal=>steamConnections(game,language,sourceSignal,offset),
    sourceSignal=>loadAtlasGame(game,sourceSignal).then(detail => Object.assign(detail?.related ?? [], {cachedAt:detail?.cachedAt})),
    signal,
  );
  signal?.throwIfAborted();
  // No Steam identity is an unsupported route, not a successful substitute for an IGDB outage.
  if (!game.steamId && atlas.status === "rejected") throw atlas.reason;
  return combineRecommendationPools(steam,atlas);
}
