import { type Meta } from "@/lib/cinemeta";
import { pickMoodSpecs } from "@/lib/feed/moods";
import { fetchUnderNinety } from "@/lib/feed/sections";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { recentlyPlayed, watchTitleKey } from "@/lib/playback-history";
import { tmdbDiscover, tmdbMovieRow, tmdbTrending } from "@/lib/providers/tmdb";

export const HERO_POOL_TARGET = 5;

export type RowSpec = {
  key: string;
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  noPaginate?: boolean;
};

export async function buildMovieHero(key: string, seen: ReturnType<typeof recentlyPlayed>): Promise<Meta[]> {
  const [topA, topB, prestigeA, prestigeB, modern] = await Promise.all([
    tmdbMovieRow(key, "top_rated", "US", 1).catch(() => [] as Meta[]),
    tmdbMovieRow(key, "top_rated", "US", 2).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      "vote_average.gte": "8.0",
      "vote_count.gte": "4000",
      sort_by: "vote_average.desc",
      page: "1",
    }).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      "vote_average.gte": "8.0",
      "vote_count.gte": "4000",
      sort_by: "vote_average.desc",
      page: "2",
    }).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      "primary_release_date.gte": "2016-01-01",
      "vote_average.gte": "7.8",
      "vote_count.gte": "2500",
      sort_by: "vote_average.desc",
      page: "1",
    }).catch(() => [] as Meta[]),
  ]);
  const pool: Meta[] = [];
  const ids = new Set<string>();
  for (const list of [prestigeA, topA, modern, prestigeB, topB]) {
    for (const m of list) {
      if (!m.background || ids.has(m.id)) continue;
      ids.add(m.id);
      pool.push(m);
    }
  }
  return rotateDaily(pool, HERO_POOL_TARGET, seen);
}

export function rotateDaily<T extends { id: string; name: string }>(
  pool: T[],
  n: number,
  seen: ReturnType<typeof recentlyPlayed>,
): T[] {
  const unseen = pool.filter((m) => !seen.ids.has(m.id) && !seen.titles.has(watchTitleKey(m.name)));
  const base = unseen.length >= n ? unseen : pool;
  if (base.length === 0) return [];
  const day = Math.floor(Date.now() / 86_400_000);
  const out: T[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < base.length) {
    let j = (day * 13 + out.length * 17) % base.length;
    while (used.has(j)) j = (j + 1) % base.length;
    used.add(j);
    out.push(base[j]);
  }
  return out;
}

export function movieSpecs(key: string, region: string): RowSpec[] {
  return [
    {
      key: "trending",
      title: "Trending This Week",
      fetcher: (p) => tmdbTrending(key, "movie", "week", p),
    },
    {
      key: "in-theaters",
      title: "In Theaters Now",
      fetcher: (p) => tmdbMovieRow(key, "now_playing", region, p),
    },
    ...pickMoodSpecs(new Date()).map(
      (m): RowSpec => ({
        key: m.id,
        title: m.title,
        fetcher: (p) => tmdbDiscover(key, "movie", { ...m.params, page: String(p) }),
      }),
    ),
    {
      key: "critics-acclaim",
      title: "Critics' Picks",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": "2015-01-01",
          "vote_average.gte": "7.6",
          "vote_count.gte": "2500",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "all-time-greats",
      title: "All-Time Greats",
      fetcher: (p) => tmdbMovieRow(key, "top_rated", region, p),
    },
    {
      key: "hidden-gems",
      title: "Hidden Gems",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "vote_average.gte": "7.6",
          "vote_count.gte": "200",
          "vote_count.lte": "1500",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "under-90",
      title: "Quick Watches Under 90",
      fetcher: (p) => fetchUnderNinety(key, p),
    },
    {
      key: "coming-soon",
      title: "Coming to Theaters",
      fetcher: (p) => tmdbMovieRow(key, "upcoming", region, p),
    },
    {
      key: "decade-2010",
      title: "Defining the 2010s",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": "2010-01-01",
          "primary_release_date.lte": "2019-12-31",
          "vote_average.gte": "7.6",
          "vote_count.gte": "2000",
          sort_by: "vote_count.desc",
          page: String(p),
        }),
    },
    {
      key: "decade-90",
      title: "Essential 90s",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": "1990-01-01",
          "primary_release_date.lte": "1999-12-31",
          "vote_average.gte": "7.6",
          "vote_count.gte": "1000",
          sort_by: "popularity.desc",
          page: String(p),
        }),
    },
    {
      key: "decade-80",
      title: "80s Classics",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": "1980-01-01",
          "primary_release_date.lte": "1989-12-31",
          "vote_average.gte": "7.4",
          "vote_count.gte": "500",
          sort_by: "popularity.desc",
          page: String(p),
        }),
    },
    {
      key: "decade-70",
      title: "70s Auteurs",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "primary_release_date.gte": "1970-01-01",
          "primary_release_date.lte": "1979-12-31",
          "vote_average.gte": "7.4",
          "vote_count.gte": "300",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "lang-jp",
      title: "Japanese Cinema",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_original_language: "ja",
          "vote_average.gte": "7.5",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "lang-kr",
      title: "Korean Cinema",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_original_language: "ko",
          "vote_average.gte": "7.5",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "lang-fr",
      title: "French Cinema",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_original_language: "fr",
          "vote_average.gte": "7.3",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
    {
      key: "doc",
      title: "Documentary Spotlight",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_genres: String(MOVIE_GENRES.Documentary),
          "vote_average.gte": "7.5",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
          page: String(p),
        }),
    },
  ];
}
