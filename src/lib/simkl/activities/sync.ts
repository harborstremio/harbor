import { simklRequest } from "../client";
import { getSession } from "../session";
import type { WatchlistStatus } from "../list-status";
import {
  emptyCache,
  getLocalCache,
  indexItem,
  pruneItem,
  saveLocalCache,
  type RawIds,
  type SimklCache,
  type SimklCacheItem,
} from "./store";

interface RawEpisode {
  number?: number;
  watched_at?: string | null;
}

interface RawSeason {
  number?: number;
  episodes?: RawEpisode[];
}

interface RawNode {
  title?: string;
  year?: number | null;
  ids?: RawIds;
  poster?: string | null;
}

interface RawEntry {
  status?: string;
  added_to_watchlist_at?: string;
  user_rating?: number | null;
  rating?: number | null;
  movie?: RawNode;
  show?: RawNode;
  anime?: RawNode;
  seasons?: RawSeason[];
}

interface RawAllItems {
  movies?: RawEntry[];
  shows?: RawEntry[];
  anime?: RawEntry[];
}

interface RawRatingEntry {
  rating?: number;
  movie?: { ids?: RawIds };
  show?: { ids?: RawIds };
  anime?: { ids?: RawIds };
}

interface RawRatingsResponse {
  movies?: RawRatingEntry[];
  shows?: RawRatingEntry[];
  anime?: RawRatingEntry[];
}

function isStatus(s: string | undefined): s is WatchlistStatus {
  return (
    s === "watching" || s === "plantowatch" || s === "hold" || s === "completed" || s === "dropped"
  );
}

function getLatestTimestamp(...dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter(Boolean) as string[];
  if (valid.length === 0) return null;
  return valid.reduce((latest, current) => (current > latest ? current : latest));
}

function parseAndMergeEntry(cache: SimklCache, entry: RawEntry, type: "movie" | "show" | "anime") {
  const node =
    type === "movie"
      ? entry.movie
      : type === "anime"
        ? entry.anime || entry.show || entry.movie
        : entry.show;
  if (!node || !node.ids || !node.ids.simkl) return;

  const simklId = node.ids.simkl;
  const simklIdStr = String(simklId);

  let status: WatchlistStatus = "plantowatch";
  if (entry.status && isStatus(entry.status)) {
    status = entry.status;
  }

  let userRating: number | null = null;
  if (entry.user_rating != null) {
    userRating = entry.user_rating;
  } else if (entry.rating != null) {
    userRating = entry.rating;
  }

  let watchedEpisodes: string[] | undefined;
  if (type !== "movie" && entry.seasons) {
    const eps: string[] = [];
    for (const s of entry.seasons) {
      for (const ep of s.episodes ?? []) {
        if (ep.watched_at && s.number != null && ep.number != null) {
          eps.push(`${s.number}:${ep.number}`);
        }
      }
    }
    if (eps.length > 0) {
      watchedEpisodes = eps;
    }
  }

  const existing = cache.items[simklIdStr];
  const item: SimklCacheItem = {
    simklId,
    type,
    title: node.title ?? existing?.title ?? "",
    year: node.year ?? existing?.year ?? null,
    status,
    userRating: userRating ?? existing?.userRating ?? null,
    watchedAt: entry.added_to_watchlist_at ?? existing?.watchedAt ?? null,
    watchedEpisodes: watchedEpisodes ?? existing?.watchedEpisodes,
    poster:
      (entry.anime?.poster || entry.show?.poster || entry.movie?.poster) ??
      existing?.poster ??
      null,
  };

  cache.items[simklIdStr] = item;
  indexItem(cache, item, node.ids);
}

function mergeRatings(cache: SimklCache, ratings: RawRatingsResponse) {
  const mergeList = (list: RawRatingEntry[] | undefined, type: "movie" | "show" | "anime") => {
    for (const entry of list ?? []) {
      const node =
        type === "movie"
          ? entry.movie
          : type === "anime"
            ? entry.anime || entry.show || entry.movie
            : entry.show;
      if (!node?.ids?.simkl) continue;
      const simklId = node.ids.simkl;
      const simklIdStr = String(simklId);

      const existing = cache.items[simklIdStr];
      if (existing) {
        existing.userRating = entry.rating ?? null;
      } else {
        const item: SimklCacheItem = {
          simklId,
          type,
          title: "",
          year: null,
          status: "completed",
          userRating: entry.rating ?? null,
          watchedAt: null,
        };
        cache.items[simklIdStr] = item;
        indexItem(cache, item, node.ids);
      }
    }
  };
  mergeList(ratings.movies, "movie");
  mergeList(ratings.shows, "show");
  mergeList(ratings.anime, "anime");
}

function applyActivities(cache: SimklCache, activities: any) {
  const tvShowsRatedAt = activities.shows?.rated_at || activities.tv_shows?.rated_at;
  const ratingsTimestamp = getLatestTimestamp(
    activities.movies?.rated_at,
    tvShowsRatedAt,
    activities.anime?.rated_at,
  );
  cache.lastSync = activities.all || new Date().toISOString();
  cache.activities = {
    movies: activities.movies?.all ?? null,
    shows: activities.shows?.all ?? activities.tv_shows?.all ?? null,
    anime: activities.anime?.all ?? null,
    ratings: ratingsTimestamp,
  };
}

async function bootstrapCache(): Promise<SimklCache> {
  const cache = emptyCache();

  const showsData = await simklRequest<RawAllItems>(
    "/sync/all-items/shows/all?extended=full&episode_watched_at=yes",
  ).catch(() => ({}) as RawAllItems);
  for (const entry of showsData.shows ?? []) {
    parseAndMergeEntry(cache, entry, "show");
  }

  const moviesData = await simklRequest<RawAllItems>(
    "/sync/all-items/movies/all?extended=full&episode_watched_at=yes",
  ).catch(() => ({}) as RawAllItems);
  for (const entry of moviesData.movies ?? []) {
    parseAndMergeEntry(cache, entry, "movie");
  }

  const animeData = await simklRequest<RawAllItems>(
    "/sync/all-items/anime/all?extended=full&episode_watched_at=yes",
  ).catch(() => ({}) as RawAllItems);
  for (const entry of animeData.anime ?? []) {
    parseAndMergeEntry(cache, entry, "anime");
  }

  const ratingsData = await simklRequest<RawRatingsResponse>("/sync/ratings").catch(
    () => ({}) as RawRatingsResponse,
  );
  mergeRatings(cache, ratingsData);

  const activities = await simklRequest<any>("/sync/activities").catch(() => null);
  if (activities) {
    applyActivities(cache, activities);
  }

  saveLocalCache(cache);
  return cache;
}

async function performDeltaSync(cache: SimklCache, activities: any): Promise<SimklCache> {
  const currentLastSync = cache.lastSync;
  if (activities.all && activities.all === currentLastSync) {
    return cache;
  }

  const dateFrom = currentLastSync ? encodeURIComponent(currentLastSync) : "";
  const deltaData = await simklRequest<RawAllItems>(`/sync/all-items?date_from=${dateFrom}`).catch(
    () => ({}) as RawAllItems,
  );

  for (const entry of deltaData.shows ?? []) {
    parseAndMergeEntry(cache, entry, "show");
  }
  for (const entry of deltaData.movies ?? []) {
    parseAndMergeEntry(cache, entry, "movie");
  }
  for (const entry of deltaData.anime ?? []) {
    parseAndMergeEntry(cache, entry, "anime");
  }

  const moviesRemoved = activities.movies?.removed_from_list;
  const tvShowsRemoved =
    activities.shows?.removed_from_list || activities.tv_shows?.removed_from_list;
  const animeRemoved = activities.anime?.removed_from_list;

  const isRemovedSinceLastSync = (removedDate: string | null | undefined) => {
    if (!removedDate || !currentLastSync) return false;
    return new Date(removedDate) > new Date(currentLastSync);
  };

  const hasRemovals =
    isRemovedSinceLastSync(moviesRemoved) ||
    isRemovedSinceLastSync(tvShowsRemoved) ||
    isRemovedSinceLastSync(animeRemoved);

  if (hasRemovals) {
    const idsOnlyData = await simklRequest<RawAllItems>(
      "/sync/all-items?extended=simkl_ids_only",
    ).catch(() => ({}) as RawAllItems);

    const validIds = new Set<number>();
    const addIds = (entries: RawEntry[] | undefined, type: "movie" | "show" | "anime") => {
      for (const e of entries ?? []) {
        const node =
          type === "movie" ? e.movie : type === "anime" ? e.anime || e.show || e.movie : e.show;
        if (node?.ids?.simkl) {
          validIds.add(node.ids.simkl);
        }
      }
    };
    addIds(idsOnlyData.movies, "movie");
    addIds(idsOnlyData.shows, "show");
    addIds(idsOnlyData.anime, "anime");

    for (const simklIdStr of Object.keys(cache.items)) {
      const item = cache.items[simklIdStr];
      if (!validIds.has(item.simklId)) {
        pruneItem(cache, item.simklId);
      }
    }
  }

  applyActivities(cache, activities);
  saveLocalCache(cache);
  return cache;
}

let activeSyncPromise: Promise<SimklCache> | null = null;

export function syncWatchlistCache(): Promise<SimklCache> {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    try {
      const session = getSession();
      if (!session) {
        throw new Error("User not authenticated");
      }

      let cache = getLocalCache();
      if (!cache || !cache.lastSync) {
        cache = await bootstrapCache();
      } else {
        const activities = await simklRequest<any>("/sync/activities").catch(() => null);
        if (activities) {
          cache = await performDeltaSync(cache, activities);
        }
      }
      return cache;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export async function getCachedSimklData(): Promise<{
  statuses: Map<string, WatchlistStatus>;
  watched: Map<string, Set<string>>;
}> {
  let cache = getLocalCache();
  if (!cache || !cache.lastSync) {
    cache = await syncWatchlistCache().catch(() => null);
  }

  const statuses = new Map<string, WatchlistStatus>();
  const watched = new Map<string, Set<string>>();

  if (!cache) {
    return { statuses, watched };
  }

  const resolved = cache;
  const registerKeys = (item: SimklCacheItem, simklId: number) => {
    const keys: string[] = [];
    for (const [imdbId, sId] of Object.entries(resolved.imdbToSimkl)) {
      if (sId === simklId) keys.push(imdbId);
    }
    for (const [tmdbKey, sId] of Object.entries(resolved.tmdbToSimkl)) {
      if (sId === simklId) {
        const parts = tmdbKey.split(":");
        if (parts.length === 2) keys.push(`tmdb:${parts[0]}:${parts[1]}`);
      }
    }
    for (const [malId, sId] of Object.entries(resolved.malToSimkl)) {
      if (sId === simklId) keys.push(`mal:${malId}`);
    }
    for (const [kitsuId, sId] of Object.entries(resolved.kitsuToSimkl)) {
      if (sId === simklId) keys.push(`kitsu:${kitsuId}`);
    }

    for (const k of keys) {
      statuses.set(k, item.status);
      if (item.watchedEpisodes && item.watchedEpisodes.length > 0) {
        watched.set(k, new Set(item.watchedEpisodes));
      }
    }
  };

  for (const simklIdStr of Object.keys(resolved.items)) {
    const item = resolved.items[simklIdStr];
    registerKeys(item, item.simklId);
  }

  return { statuses, watched };
}
