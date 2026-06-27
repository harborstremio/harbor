import { traktRequest } from "./client";
import type { TraktItem } from "./types";

export type CalendarEpisode = TraktItem & {
  type: "show";
  airDate: string;
  season: number;
  number: number;
  episodeTitle?: string;
};

function utcIsoToLocalDate(iso: string): string {
  if (!iso) return "";
  if (!iso.includes("T")) return iso.slice(0, 10);
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchUpcomingEpisodes(days = 14): Promise<CalendarEpisode[]> {
  type Raw = {
    first_aired: string;
    episode: { season: number; number: number; title?: string; ids: { imdb?: string; tmdb?: number; tvdb?: number } };
    show: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number; tvdb?: number } };
  };
  const today = localDateToday();
  const rows = await traktRequest<Raw[]>(
    `/calendars/my/shows/${today}/${days}`,
  ).catch(() => [] as Raw[]);
  return rows.map((r) => ({
    type: "show" as const,
    title: r.show.title,
    year: r.show.year,
    ids: r.show.ids,
    airDate: utcIsoToLocalDate(r.first_aired),
    season: r.episode.season,
    number: r.episode.number,
    episodeTitle: r.episode.title,
  }));
}

export async function fetchUpcomingMovies(days = 30): Promise<TraktItem[]> {
  type Raw = {
    released: string;
    movie: { title: string; year: number | null; ids: { imdb?: string; tmdb?: number } };
  };
  const today = localDateToday();
  const rows = await traktRequest<Raw[]>(
    `/calendars/my/movies/${today}/${days}`,
  ).catch(() => [] as Raw[]);
  return rows.map((r) => ({
    type: "movie" as const,
    title: r.movie.title,
    year: r.movie.year,
    ids: r.movie.ids,
    contextDate: r.released,
  }));
}

export type AnticipatedShow = {
  title: string;
  year: number | null;
  ids: { imdb?: string; tmdb?: number; tvdb?: number };
  firstAired: string;
  poster: string | null;
  overview: string;
};

export type AnticipatedMovie = {
  title: string;
  year: number | null;
  ids: { imdb?: string; tmdb?: number };
  released: string;
  poster: string | null;
  overview: string;
};

export async function fetchAnticipatedShows(): Promise<AnticipatedShow[]> {
  type Raw = {
    list_count?: number;
    show: {
      title: string;
      year: number | null;
      first_aired?: string;
      overview?: string;
      ids: { imdb?: string; tmdb?: number; tvdb?: number };
    };
  };
  const rows = await traktRequest<Raw[]>(
    `/shows/anticipated?extended=full&limit=100`,
    { authed: false },
  ).catch(() => [] as Raw[]);
  return rows
    .filter((r) => r.show.first_aired)
    .map((r) => ({
      title: r.show.title,
      year: r.show.year,
      ids: r.show.ids,
      firstAired: utcIsoToLocalDate(r.show.first_aired ?? ""),
      poster: null,
      overview: r.show.overview ?? "",
    }));
}

export async function fetchAnticipatedMovies(): Promise<AnticipatedMovie[]> {
  type Raw = {
    list_count?: number;
    movie: {
      title: string;
      year: number | null;
      released?: string;
      overview?: string;
      ids: { imdb?: string; tmdb?: number };
    };
  };
  const rows = await traktRequest<Raw[]>(
    `/movies/anticipated?extended=full&limit=100`,
    { authed: false },
  ).catch(() => [] as Raw[]);
  return rows
    .filter((r) => r.movie.released)
    .map((r) => ({
      title: r.movie.title,
      year: r.movie.year,
      ids: r.movie.ids,
      released: utcIsoToLocalDate(r.movie.released ?? ""),
      poster: null,
      overview: r.movie.overview ?? "",
    }));
}
