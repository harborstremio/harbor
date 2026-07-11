import type { WatchlistStatus } from "../list-status";
import type { SimklTarget } from "../types";
import { getLocalCache, indexItem, pruneItem, saveLocalCache, type RawIds, type SimklCacheItem } from "./store";

function targetIds(target: SimklTarget): RawIds | undefined {
  const ids =
    target.kind === "episode" ? target.show.ids : target.kind === "anime-episode" ? target.anime.ids : target.ids;
  return ids as RawIds;
}

function targetType(target: SimklTarget): "movie" | "show" | "anime" {
  if (target.kind === "movie") return "movie";
  if (target.kind === "anime" || target.kind === "anime-episode") return "anime";
  return "show";
}

export function updateCachedStatus(
  simklId: number,
  type: "movie" | "show" | "anime",
  title: string,
  year: number | null,
  status: WatchlistStatus | null,
  externalIds?: RawIds,
) {
  const cache = getLocalCache();
  if (!cache) return;

  const simklIdStr = String(simklId);
  if (status === null) {
    pruneItem(cache, simklId);
  } else {
    const existing = cache.items[simklIdStr];
    const item: SimklCacheItem = {
      simklId,
      type,
      title: title || existing?.title || "",
      year: year ?? existing?.year ?? null,
      status,
      userRating: existing?.userRating ?? null,
      watchedAt: existing?.watchedAt ?? new Date().toISOString(),
      watchedEpisodes: existing?.watchedEpisodes,
      poster: existing?.poster ?? null,
    };
    cache.items[simklIdStr] = item;
    if (externalIds) {
      indexItem(cache, item, externalIds);
    }
  }

  saveLocalCache(cache);
}

export function updateCachedStatusByTarget(target: SimklTarget, status: WatchlistStatus | null) {
  const ids = targetIds(target);
  if (!ids?.simkl) return;
  updateCachedStatus(ids.simkl, targetType(target), "", null, status, ids);
}

export function updateCachedRatingByTarget(target: SimklTarget, rating: number | null) {
  const cache = getLocalCache();
  if (!cache) return;

  const ids = targetIds(target);
  if (!ids?.simkl) return;

  const simklIdStr = String(ids.simkl);
  const existing = cache.items[simklIdStr];
  if (existing) {
    existing.userRating = rating;
  } else {
    const item: SimklCacheItem = {
      simklId: ids.simkl,
      type: targetType(target),
      title: "",
      year: null,
      status: "completed",
      userRating: rating,
      watchedAt: new Date().toISOString(),
    };
    cache.items[simklIdStr] = item;
    indexItem(cache, item, ids);
  }

  saveLocalCache(cache);
}

export function getCachedRatingByTarget(target: SimklTarget): number | null {
  const cache = getLocalCache();
  if (!cache) return null;
  const ids = targetIds(target);
  if (!ids?.simkl) return null;
  return cache.items[String(ids.simkl)]?.userRating ?? null;
}
