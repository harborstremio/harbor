import { traktRequest } from "./client";
import type { TraktItem } from "./types";

type RawMovie = { title: string; year: number | null; ids: { imdb?: string; tmdb?: number; trakt?: number } };
type RawShow = {
  title: string;
  year: number | null;
  ids: { imdb?: string; tmdb?: number; tvdb?: number; trakt?: number };
};

export async function fetchMovieRecommendations(): Promise<TraktItem[]> {
  const rows = await traktRequest<RawMovie[]>("/recommendations/movies?limit=40&ignore_collected=true").catch(
    () => [] as RawMovie[],
  );
  return rows.map((m) => ({
    type: "movie" as const,
    title: m.title,
    year: m.year,
    ids: m.ids,
  }));
}

export async function fetchShowRecommendations(): Promise<TraktItem[]> {
  const rows = await traktRequest<RawShow[]>("/recommendations/shows?limit=40&ignore_collected=true").catch(
    () => [] as RawShow[],
  );
  return rows.map((s) => ({
    type: "show" as const,
    title: s.title,
    year: s.year,
    ids: s.ids,
  }));
}
