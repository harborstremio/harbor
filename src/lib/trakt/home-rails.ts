import type { HomeRow } from "@/views/home/home-types";

import { fetchUpcomingEpisodes } from "./calendar";
import { hydrateTraktItems } from "./hydrate";
import { fetchMovieRecommendations, fetchShowRecommendations } from "./recommendations";
import type { TraktItem } from "./types";
import { fetchWatchlist } from "./watchlist";

const PER_RAIL = 24;

export async function buildTraktHomeRows(tmdbKey: string): Promise<HomeRow[]> {
  const [watchlist, movieRecs, showRecs, upcoming] = await Promise.all([
    fetchWatchlist().catch(() => []),
    fetchMovieRecommendations().catch(() => []),
    fetchShowRecommendations().catch(() => []),
    fetchUpcomingEpisodes(14).catch(() => []),
  ]);

  const upcomingItems: TraktItem[] = dedupeItems(
    upcoming.map((ep) => ({
      type: "show" as const,
      title: ep.title,
      year: ep.year,
      ids: ep.ids,
    })),
  );

  const [watchlistMetas, upcomingMetas, recMovieMetas, recShowMetas] = await Promise.all([
    hydrateTraktItems(watchlist.slice(0, PER_RAIL), tmdbKey),
    hydrateTraktItems(upcomingItems.slice(0, PER_RAIL), tmdbKey),
    hydrateTraktItems(movieRecs.slice(0, PER_RAIL), tmdbKey),
    hydrateTraktItems(showRecs.slice(0, PER_RAIL), tmdbKey),
  ]);

  const rows: HomeRow[] = [];
  const pager = (items: TraktItem[]) => async (page: number) => {
    const slice = items.slice((page - 1) * PER_RAIL, page * PER_RAIL);
    if (slice.length === 0) return [];
    return hydrateTraktItems(slice, tmdbKey);
  };

  if (watchlistMetas.length >= 4) {
    rows.push({
      key: "trakt-watchlist",
      type: watchlist[0]?.type === "show" ? "series" : "movie",
      name: "Your Trakt Watchlist",
      metas: watchlistMetas,
      page: 1,
      hasMore: false,
      noDedup: true,
      fetcher: pager(watchlist),
    });
  }

  if (upcomingMetas.length >= 4) {
    rows.push({
      key: "trakt-upcoming",
      type: "series",
      name: "Up Next on Trakt",
      metas: upcomingMetas,
      page: 1,
      hasMore: false,
      noDedup: true,
      fetcher: pager(upcomingItems),
    });
  }

  if (recMovieMetas.length >= 4) {
    rows.push({
      key: "trakt-recs-movies",
      type: "movie",
      name: "Trakt Recommends: Movies",
      metas: recMovieMetas,
      page: 1,
      hasMore: false,
      noDedup: true,
      fetcher: pager(movieRecs),
    });
  }

  if (recShowMetas.length >= 4) {
    rows.push({
      key: "trakt-recs-shows",
      type: "series",
      name: "Trakt Recommends: Series",
      metas: recShowMetas,
      page: 1,
      hasMore: false,
      noDedup: true,
      fetcher: pager(showRecs),
    });
  }

  return rows;
}

function dedupeItems(items: TraktItem[]): TraktItem[] {
  const seen = new Set<string>();
  const out: TraktItem[] = [];
  for (const it of items) {
    const k = it.ids.imdb ?? (it.ids.tmdb != null ? `tmdb:${it.ids.tmdb}` : null);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
