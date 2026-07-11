import type { Meta } from "@/lib/cinemeta";
import { topMovies, topSeries } from "@/lib/cinemeta";
import { tmdbDiscover, tmdbMovieRow, tmdbSeriesRow, tmdbTrending } from "@/lib/providers/tmdb";

import { DECADES, LANGUAGES, MOVIE_GENRES, dailySeed, pickRandom, shuffle } from "./tags";

export type Shelf = {
  id: string;
  title: string;
  kicker?: string;
  fetch: (page?: number) => Promise<Meta[]>;
};

export function pickShelves(tmdbKey: string, n = 8): Shelf[] {
  if (!tmdbKey) return fallbackShelves();
  return tmdbShelves(tmdbKey, n);
}

function tmdbShelves(key: string, n: number): Shelf[] {
  const seed = dailySeed();
  const genres = pickRandom(Object.keys(MOVIE_GENRES), 4, seed + 10);
  const decades = pickRandom(DECADES, 3, seed + 20);
  const languages = pickRandom(LANGUAGES, 2, seed + 30);

  const all: Shelf[] = [];

  all.push({
    id: "trending_week",
    title: "Trending This Week",
    kicker: "What people are watching",
    fetch: (page = 1) => tmdbTrending(key, "movie", "week", page),
  });

  all.push({
    id: "in_theaters",
    title: "In Theaters",
    kicker: "Showing now",
    fetch: (page = 1) => tmdbMovieRow(key, "now_playing", "US", page),
  });

  all.push({
    id: "critically_loved",
    title: "Critically Loved",
    kicker: "Vote average ≥ 8.0",
    fetch: (page = 1) =>
      tmdbDiscover(key, "movie", {
        "vote_average.gte": "8.0",
        "vote_count.gte": "1000",
        "with_runtime.gte": "70",
        sort_by: "vote_average.desc",
        page: String(page),
      }),
  });

  all.push({
    id: "hidden_gems",
    title: "Highly Rated, Quietly Loved",
    kicker: "High score, low fanfare",
    fetch: (page = 1) =>
      tmdbDiscover(key, "movie", {
        "vote_average.gte": "7.2",
        "vote_count.gte": "300",
        "vote_count.lte": "3500",
        "with_runtime.gte": "70",
        sort_by: "vote_average.desc",
        page: String(page),
      }),
  });

  all.push({
    id: "cult_classics",
    title: "Cult Classics",
    kicker: "Beloved, slightly forgotten",
    fetch: (page = 1) =>
      tmdbDiscover(key, "movie", {
        "primary_release_date.lte": "1999-12-31",
        "vote_average.gte": "7.4",
        "vote_count.gte": "300",
        "vote_count.lte": "5000",
        sort_by: "vote_average.desc",
        page: String(page),
      }),
  });

  all.push({
    id: "series_top",
    title: "Series, Critically Acclaimed",
    kicker: "Top rated television",
    fetch: (page = 1) => tmdbSeriesRow(key, "top_rated", page),
  });

  for (const g of genres) {
    all.push({
      id: `genre_${g}`,
      title: `Top Rated ${g}`,
      fetch: (page = 1) =>
        tmdbDiscover(key, "movie", {
          with_genres: String(MOVIE_GENRES[g]),
          "vote_average.gte": "6.8",
          "vote_count.gte": "300",
          "with_runtime.gte": "70",
          sort_by: "vote_average.desc",
          page: String(page),
        }),
    });
  }

  for (const d of decades) {
    all.push({
      id: `decade_${d.label}`,
      title: `Hidden Gems · ${d.label}`,
      kicker: `From the ${d.label}`,
      fetch: (page = 1) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": d.from,
          "primary_release_date.lte": d.to,
          "vote_average.gte": "7.2",
          "vote_count.gte": "200",
          "vote_count.lte": "3000",
          "with_runtime.gte": "70",
          sort_by: "vote_average.desc",
          page: String(page),
        }),
    });
  }

  for (const l of languages) {
    all.push({
      id: `lang_${l.code}`,
      title: l.label,
      kicker: "Top rated abroad",
      fetch: (page = 1) =>
        tmdbDiscover(key, "movie", {
          with_original_language: l.code,
          "vote_average.gte": "7.0",
          "vote_count.gte": "150",
          sort_by: "vote_average.desc",
          page: String(page),
        }),
    });
  }

  all.push({
    id: "animated_for_grown_ups",
    title: "Animated, For Grown-Ups",
    kicker: "Beyond the kids' shelf",
    fetch: (page = 1) =>
      tmdbDiscover(key, "movie", {
        with_genres: String(MOVIE_GENRES.Animation),
        "vote_average.gte": "7.4",
        "vote_count.gte": "500",
        sort_by: "vote_average.desc",
        page: String(page),
      }),
  });

  return shuffle(all, seed).slice(0, n);
}

export function fallbackShelves(): Shelf[] {
  const genres = ["Drama", "Comedy", "Action", "Crime", "Sci-Fi", "Thriller", "Horror", "Romance"];
  const seed = dailySeed();
  const picked = pickRandom(genres, 5, seed);
  const all: Shelf[] = [
    { id: "cinemeta_movies", title: "Top Movies", fetch: () => topMovies() },
    { id: "cinemeta_series", title: "Top Series", fetch: () => topSeries() },
    ...picked.map((g) => ({
      id: `cinemeta_${g}`,
      title: `Top ${g}`,
      fetch: () => topMovies(g),
    })),
  ];
  return all;
}
