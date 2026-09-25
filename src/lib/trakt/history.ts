import { traktRequest } from "./client";
import type { TraktTarget } from "./types";

export type HistoryItem = {
  id: number;
  watchedAt: string;
  type: "movie" | "episode";
  imdb?: string;
  tmdb?: number;
  title: string;
  year: number | null;
  showImdb?: string;
  showTmdb?: number;
  season?: number;
  number?: number;
};

export async function fetchWatchedHistory(limit = 200): Promise<HistoryItem[]> {
  type Raw = {
    id: number;
    watched_at: string;
    type: "movie" | "episode";
    movie?: {
      title: string;
      year: number | null;
      ids: { imdb?: string; tmdb?: number };
    };
    episode?: {
      season: number;
      number: number;
      title?: string;
      ids: { imdb?: string; tmdb?: number };
    };
    show?: {
      title: string;
      year: number | null;
      ids: { imdb?: string; tmdb?: number };
    };
  };
  const rows = await traktRequest<Raw[]>(`/sync/history?limit=${limit}`).catch(
    () => [] as Raw[],
  );
  return rows.map((r) => {
    if (r.type === "movie" && r.movie) {
      return {
        id: r.id,
        watchedAt: r.watched_at,
        type: "movie" as const,
        title: r.movie.title,
        year: r.movie.year,
        imdb: r.movie.ids.imdb,
        tmdb: r.movie.ids.tmdb,
      };
    }
    return {
      id: r.id,
      watchedAt: r.watched_at,
      type: "episode" as const,
      title: r.show?.title ?? "",
      year: r.show?.year ?? null,
      showImdb: r.show?.ids.imdb,
      showTmdb: r.show?.ids.tmdb,
      season: r.episode?.season,
      number: r.episode?.number,
    };
  });
}

type HistoryWriteResponse = {
  added?: { movies?: number; episodes?: number };
  existing?: { movies?: number; episodes?: number };
};

// Trakt returns 200 with the miss listed under `not_found`, so the status alone cannot
// distinguish a write from a no-op.
function writtenCount(response: HistoryWriteResponse | undefined): number {
  return (
    (response?.added?.movies ?? 0) +
    (response?.added?.episodes ?? 0) +
    (response?.existing?.movies ?? 0) +
    (response?.existing?.episodes ?? 0)
  );
}

export async function pushWatched(target: TraktTarget): Promise<boolean> {
  try {
    if (target.kind === "movie") {
      const response = await traktRequest<HistoryWriteResponse>("/sync/history", {
        method: "POST",
        body: { movies: [{ ids: target.ids }] },
      });
      return writtenCount(response) > 0;
    }
    if (target.kind === "episode") {
      const body =
        target.episodeIds && Object.keys(target.episodeIds).length > 0
          ? { episodes: [{ ids: target.episodeIds }] }
          : {
              shows: [
                {
                  ids: target.show.ids,
                  seasons: [
                    { number: target.season, episodes: [{ number: target.number }] },
                  ],
                },
              ],
            };
      const response = await traktRequest<HistoryWriteResponse>("/sync/history", {
        method: "POST",
        body,
      });
      return writtenCount(response) > 0;
    }
  } catch {
    return false;
  }
  return false;
}

export async function fetchWatchedKeySet(): Promise<Set<string>> {
  const rows = await fetchWatchedHistory(1000);
  const set = new Set<string>();
  for (const r of rows) {
    if (r.type === "movie") {
      if (r.imdb) set.add(`imdb:${r.imdb}`);
      if (r.tmdb) set.add(`tmdb:${r.tmdb}`);
    } else {
      if (r.showImdb && r.season != null && r.number != null) {
        set.add(`imdb:${r.showImdb}:${r.season}:${r.number}`);
      }
      if (r.showTmdb && r.season != null && r.number != null) {
        set.add(`tmdb:${r.showTmdb}:${r.season}:${r.number}`);
      }
    }
  }
  return set;
}
