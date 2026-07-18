import { traktRequest } from "./client";
import type { TraktItem } from "./types";

type RawListItem = {
  rank?: number;
  listed_at?: string;
  type: "movie" | "show";
  movie?: {
    title: string;
    year: number | null;
    ids: { imdb?: string; tmdb?: number; trakt?: number };
  };
  show?: {
    title: string;
    year: number | null;
    ids: { imdb?: string; tmdb?: number; tvdb?: number; trakt?: number };
  };
};

export async function fetchTraktList(
  listId: string | number,
  page: number = 1,
  limit: number = 20,
): Promise<TraktItem[]> {
  const rows = await traktRequest<RawListItem[]>(
    `/lists/${listId}/items?page=${page}&limit=${limit}`,
    { authed: false },
  ).catch(() => []);

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
