import { pmdbRequest } from "./client";
import { isAuthenticated } from "./session";
import type { Meta } from "@/lib/cinemeta";
import type {
  PmdbList,
  PmdbListItem,
  PmdbListItemsResponse,
  PmdbListsResponse,
  PmdbTarget,
} from "./types";

let cachedWatchlistId: string | null = null;

export function clearPmdbWatchlistCache(): void {
  cachedWatchlistId = null;
}

async function getWatchlistId(): Promise<string | null> {
  if (cachedWatchlistId) return cachedWatchlistId;
  try {
    const res = await pmdbRequest<PmdbListsResponse>("/api/external/lists", {
      method: "GET",
    });
    const watchlist = res?.items?.find((l: PmdbList) => l.type === "watchlist");
    if (watchlist?.id) {
      cachedWatchlistId = watchlist.id;
      return watchlist.id;
    }
    return null;
  } catch {
    return null;
  }
}

const WATCHLIST_PER_PAGE = 100;
const WATCHLIST_MAX_PAGES = 10;

export async function fetchPmdbWatchlist(): Promise<PmdbListItem[]> {
  if (!isAuthenticated()) return [];
  const listId = await getWatchlistId();
  if (!listId) return [];

  // List items paginate (page/perPage, max 500). Loop defensively: stop on a
  // short page so an envelope without page counts still terminates.
  const out: PmdbListItem[] = [];
  try {
    for (let page = 1; page <= WATCHLIST_MAX_PAGES; page++) {
      const res = await pmdbRequest<PmdbListItemsResponse>(
        `/api/external/lists/${encodeURIComponent(listId)}/items?page=${page}&perPage=${WATCHLIST_PER_PAGE}`,
        { method: "GET" },
      );
      const items = res?.items ?? [];
      out.push(...items);
      if (items.length < WATCHLIST_PER_PAGE) break;
    }
  } catch {
    /* return what we have */
  }
  return out;
}

export function pmdbWatchlistContains(
  items: PmdbListItem[],
  target: PmdbTarget,
): PmdbListItem | null {
  if (target.tmdb_id == null) return null;
  return (
    items.find((i) => i.tmdb_id === target.tmdb_id && i.media_type === target.media_type) ?? null
  );
}

/**
 * Maps a watchlist item to a Harbor Meta for grid rendering. The poster
 * field shape is unverified (full URL vs TMDB path vs absent), so all three
 * are handled and title-only cards remain renderable.
 */
export function pmdbWatchlistItemToMeta(item: PmdbListItem): Meta | null {
  if (item.tmdb_id == null) return null;
  const isMovie = item.media_type === "movie";
  let poster: string | undefined;
  const raw = typeof item.poster === "string" ? item.poster.trim() : "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    poster = raw;
  } else if (raw.startsWith("/") && raw.length > 1) {
    poster = `https://image.tmdb.org/t/p/w500${raw}`;
  }
  return {
    id: isMovie ? `tmdb:movie:${item.tmdb_id}` : `tmdb:tv:${item.tmdb_id}`,
    type: isMovie ? "movie" : "series",
    name: item.title || (isMovie ? `Movie (${item.tmdb_id})` : `Series (${item.tmdb_id})`),
    releaseInfo: item.year != null ? String(item.year) : undefined,
    poster,
  };
}

export async function addToPmdbWatchlist(target: PmdbTarget): Promise<boolean> {
  if (!isAuthenticated()) return false;
  // Add-to-list takes tmdb_id + media_type only; resolve first, never send
  // ID-only targets the server must reject.
  if (target.tmdb_id == null) return false;
  const listId = await getWatchlistId();
  if (!listId) return false;

  try {
    await pmdbRequest(`/api/external/lists/${encodeURIComponent(listId)}/items`, {
      method: "POST",
      body: {
        tmdb_id: target.tmdb_id,
        media_type: target.media_type,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeFromPmdbWatchlist(target: PmdbTarget): Promise<boolean> {
  if (!isAuthenticated()) return false;
  const listId = await getWatchlistId();
  if (!listId) return false;

  try {
    // Fetch items to find matching itemId
    const items = await fetchPmdbWatchlist();
    const item = pmdbWatchlistContains(items, target);
    if (!item?.id) return false;

    await pmdbRequest(`/api/external/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    return true;
  } catch {
    return false;
  }
}
