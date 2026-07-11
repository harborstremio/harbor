import { topMovies, type Meta } from "@/lib/cinemeta";
import { topEntries } from "@/lib/discover/affinity";
import { getStore } from "@/lib/discover/store";
import { recentlyPlayed, watchTitleKey } from "@/lib/playback-history";
import { tmdbDiscover, tmdbMovieRow, tmdbSeriesRow, tmdbTrending } from "@/lib/providers/tmdb";
import type { Settings } from "@/lib/settings";

import { localizeFloor } from "./locale";
import { getDownvotedIds, getUpvotedIds } from "./preferences";
import { rankMetasByAffinity } from "./rank";
import { MOVIE_GENRES } from "./tags";

const GENRE_ALIAS: Record<string, number> = {
  "Science Fiction": 878,
  "Action & Adventure": 28,
  "Sci-Fi & Fantasy": 878,
};

export function genreToTmdbId(name: string): number | undefined {
  return MOVIE_GENRES[name] ?? GENRE_ALIAS[name];
}

function votedIds(): Set<string> {
  const ids = new Set<string>();
  for (const id of getDownvotedIds()) ids.add(id);
  for (const id of getUpvotedIds()) ids.add(id);
  return ids;
}

function tasteSeedGenres(): number[] {
  const { affinity } = getStore();
  if (affinity.totalEvents === 0) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const [name, w] of topEntries(affinity.genres, 6)) {
    if (w <= 0) continue;
    const gid = genreToTmdbId(name);
    if (gid == null || seen.has(gid)) continue;
    seen.add(gid);
    out.push(gid);
    if (out.length >= 3) break;
  }
  return out;
}

export async function fetchFeatured(tmdbKey: string, settings?: Settings): Promise<Meta[]> {
  const blocked = votedIds();
  const watched = recentlyPlayed();
  const loc = (floor: Record<string, string>) => (settings ? localizeFloor(floor, settings, "movie") : floor);
  const skip = (m: Meta) => blocked.has(m.id) || watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
  if (!tmdbKey) {
    const list = await topMovies();
    const pool = list.filter((m) => m.background && !skip(m)).slice(0, 40);
    return rankMetasByAffinity(pool).slice(0, 10);
  }
  const seedReqs = tasteSeedGenres().map((gid) =>
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        with_genres: String(gid),
        "vote_average.gte": "6.8",
        "vote_count.gte": "600",
        sort_by: "popularity.desc",
        page: "1",
      }),
    ),
  );
  const [topRated, trending, acclaimed, ...seeds] = await Promise.all([
    tmdbMovieRow(tmdbKey, "top_rated", settings?.region ?? "US", 1),
    tmdbTrending(tmdbKey, "movie", "week", 1),
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        "vote_average.gte": "8.0",
        "vote_count.gte": "3000",
        sort_by: "vote_count.desc",
        page: "1",
      }),
    ),
    ...seedReqs,
  ]);
  const seen = new Set<string>();
  const pool: Meta[] = [];
  const push = (m?: Meta) => {
    if (!m || seen.has(m.id) || !m.background || skip(m)) return;
    seen.add(m.id);
    pool.push(m);
  };
  for (let i = 0; i < 20 && pool.length < 40; i++) {
    for (const list of seeds as Meta[][]) push(list[i]);
  }
  const slots = [trending, topRated, acclaimed];
  for (let i = 0; i < 16 && pool.length < 40; i++) {
    for (const list of slots) push(list[i]);
  }
  return rankMetasByAffinity(pool).slice(0, 10);
}

export async function fetchCriticsPickList(tmdbKey: string, settings?: Settings): Promise<Meta[]> {
  if (!tmdbKey) return [];
  const loc = (floor: Record<string, string>) => (settings ? localizeFloor(floor, settings, "movie") : floor);
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86_400_000);
  const pageOf = (offset: number) => String(((dayOfYear + offset) % 5) + 1);
  const queries = await Promise.all([
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        "vote_average.gte": "8.0",
        "vote_count.gte": "5000",
        sort_by: "vote_average.desc",
        page: pageOf(0),
      }),
    ),
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        "vote_average.gte": "7.6",
        "vote_count.gte": "1500",
        "primary_release_date.gte": "2018-01-01",
        sort_by: "vote_average.desc",
        page: pageOf(1),
      }),
    ),
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        "vote_average.gte": "7.5",
        "vote_count.gte": "1200",
        sort_by: "vote_count.desc",
        page: pageOf(2),
      }),
    ),
    tmdbDiscover(
      tmdbKey,
      "movie",
      loc({
        "vote_average.gte": "7.5",
        "vote_count.gte": "800",
        "primary_release_date.lte": "1999-12-31",
        sort_by: "vote_average.desc",
        page: pageOf(3),
      }),
    ),
  ]);
  const watched = recentlyPlayed();
  const seen = new Set<string>();
  const merged: Meta[] = [];
  const max = Math.max(...queries.map((q) => q.length));
  for (let i = 0; i < max; i++) {
    for (const list of queries) {
      const m = list[i];
      if (!m || seen.has(m.id)) continue;
      if (watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name))) continue;
      seen.add(m.id);
      merged.push(m);
    }
  }
  return merged;
}

export async function fetchUnderNinety(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbDiscover(tmdbKey, "movie", {
    "with_runtime.lte": "90",
    "with_runtime.gte": "70",
    "vote_average.gte": "7.0",
    "vote_count.gte": "300",
    sort_by: "vote_average.desc",
    page: String(page),
  });
}

export async function fetchRecentlyAdded(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  const day = 24 * 60 * 60 * 1000;
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  return tmdbDiscover(tmdbKey, "movie", {
    "primary_release_date.gte": fmt(Date.now() - 90 * day),
    "primary_release_date.lte": fmt(Date.now()),
    "vote_count.gte": "50",
    "with_runtime.gte": "70",
    sort_by: "popularity.desc",
    page: String(page),
  });
}

export async function fetchComingSoon(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbMovieRow(tmdbKey, "upcoming", "US", page);
}

export async function fetchInTheaters(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbMovieRow(tmdbKey, "now_playing", "US", page);
}

export async function fetchTopRated(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbMovieRow(tmdbKey, "top_rated", "US", page);
}

export async function fetchTrendingWeek(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbTrending(tmdbKey, "movie", "week", page);
}

export async function fetchTopSeries(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbSeriesRow(tmdbKey, "top_rated", page);
}

export async function fetchDocumentaries(tmdbKey: string, page = 1): Promise<Meta[]> {
  if (!tmdbKey) return [];
  return tmdbDiscover(tmdbKey, "movie", {
    with_genres: String(MOVIE_GENRES.Documentary),
    "vote_average.gte": "7.5",
    "vote_count.gte": "200",
    sort_by: "vote_average.desc",
    page: String(page),
  });
}

export async function fetchGenreSample(tmdbKey: string, genre: string): Promise<Meta[]> {
  if (tmdbKey && MOVIE_GENRES[genre]) {
    return tmdbDiscover(tmdbKey, "movie", {
      with_genres: String(MOVIE_GENRES[genre]),
      "vote_average.gte": "7.0",
      "vote_count.gte": "500",
      sort_by: "popularity.desc",
      page: "1",
    });
  }
  const { topMovies } = await import("@/lib/cinemeta");
  return topMovies(genre).then((list) => list.slice(0, 24));
}
