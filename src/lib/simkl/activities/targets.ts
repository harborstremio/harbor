import type { SimklTarget } from "../types";
import type { WatchlistStatus } from "../list-status";
import {
  getLocalCache,
  indexItem,
  pruneItem,
  saveLocalCache,
  type RawIds,
  type SimklCache,
  type SimklCacheItem,
} from "./store";

function targetIds(target: SimklTarget): RawIds | undefined {
  const ids =
    target.kind === "episode"
      ? target.show.ids
      : target.kind === "anime-episode"
        ? target.anime.ids
        : target.ids;
  return ids as RawIds;
}

function targetType(target: SimklTarget): "movie" | "show" | "anime" {
  if (target.kind === "movie") return "movie";
  if (target.kind === "anime" || target.kind === "anime-episode") return "anime";
  return "show";
}

function cachedTargetId(cache: SimklCache, target: SimklTarget): number | undefined {
  const ids = targetIds(target);
  if (!ids) return undefined;
  if (ids.simkl != null) return ids.simkl;
  // Detail pages normally carry provider IDs, while cached items use SIMKL IDs.
  // Keep movie and TV namespaces separate when resolving the same TMDB number.
  return (
    (ids.imdb ? cache.imdbToSimkl[ids.imdb] : undefined) ??
    (ids.tmdb != null
      ? cache.tmdbToSimkl[`${targetType(target) === "movie" ? "movie" : "tv"}:${ids.tmdb}`]
      : undefined) ??
    (ids.mal != null ? cache.malToSimkl[String(ids.mal)] : undefined) ??
    (ids.kitsu != null ? cache.kitsuToSimkl[String(ids.kitsu)] : undefined)
  );
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
  const simklId = cachedTargetId(cache, target);
  if (simklId == null) return;

  const simklIdStr = String(simklId);
  const existing = cache.items[simklIdStr];
  if (existing) {
    existing.userRating = rating;
  } else {
    const item: SimklCacheItem = {
      simklId,
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
  const simklId = cachedTargetId(cache, target);
  if (simklId == null) return null;
  return cache.items[String(simklId)]?.userRating ?? null;
}
