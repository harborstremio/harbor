import { traktRequest } from "./client";
import type { TraktItem, TraktTarget } from "./types";

type RawWatchlistRow = {
  rank?: number;
  listed_at: string;
  type: "movie" | "show";
  movie?: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number; trakt?: number } };
  show?: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number; tvdb?: number; trakt?: number } };
};

export async function fetchWatchlist(): Promise<TraktItem[]> {
  const rows = await traktRequest<RawWatchlistRow[]>("/sync/watchlist?sort_by=added&sort_how=desc").catch(
    () => [] as RawWatchlistRow[],
  );
  const out: TraktItem[] = [];
  for (const r of rows) {
    if (r.type === "movie" && r.movie) {
      out.push({
        type: "movie",
        title: r.movie.title,
        year: r.movie.year,
        ids: r.movie.ids,
        contextDate: r.listed_at,
      });
    } else if (r.type === "show" && r.show) {
      out.push({
        type: "show",
        title: r.show.title,
        year: r.show.year,
        ids: r.show.ids,
        contextDate: r.listed_at,
      });
    }
  }
  return out;
}

export async function addToWatchlist(target: TraktTarget): Promise<boolean> {
  try {
    if (target.kind === "movie") {
      await traktRequest("/sync/watchlist", {
        method: "POST",
        body: { movies: [{ ids: target.ids }] },
      });
      return true;
    }
    if (target.kind === "show" || target.kind === "episode") {
      const ids = target.kind === "show" ? target.ids : target.show.ids;
      await traktRequest("/sync/watchlist", {
        method: "POST",
        body: { shows: [{ ids }] },
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function removeFromWatchlist(target: TraktTarget): Promise<boolean> {
  try {
    if (target.kind === "movie") {
      await traktRequest("/sync/watchlist/remove", {
        method: "POST",
        body: { movies: [{ ids: target.ids }] },
      });
      return true;
    }
    if (target.kind === "show" || target.kind === "episode") {
      const ids = target.kind === "show" ? target.ids : target.show.ids;
      await traktRequest("/sync/watchlist/remove", {
        method: "POST",
        body: { shows: [{ ids }] },
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
