import { type Meta } from "@/lib/cinemeta";
import { recentlyPlayed } from "@/lib/playback-history";
import { tmdbDiscover } from "@/lib/providers/tmdb";

import { rotateDaily, type RowSpec } from "../movies/movie-specs";

const KID_MOVIE: Record<string, string> = {
  certification_country: "US",
  "certification.lte": "PG",
  without_genres: "27,53",
  include_adult: "false",
};

const KID_TV: Record<string, string> = {
  without_genres: "27,53",
  include_adult: "false",
};

export async function buildKidsHero(key: string, seen: ReturnType<typeof recentlyPlayed>): Promise<Meta[]> {
  const [familyTop, animPop, familyPop] = await Promise.all([
    tmdbDiscover(key, "movie", {
      with_genres: "10751",
      "vote_average.gte": "7.0",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
      page: "1",
      ...KID_MOVIE,
    }).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      with_genres: "16",
      "vote_count.gte": "500",
      sort_by: "popularity.desc",
      page: "1",
      ...KID_MOVIE,
    }).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      with_genres: "10751",
      "vote_count.gte": "400",
      sort_by: "popularity.desc",
      page: "1",
      ...KID_MOVIE,
    }).catch(() => [] as Meta[]),
  ]);
  const pool: Meta[] = [];
  const ids = new Set<string>();
  for (const list of [familyTop, animPop, familyPop]) {
    for (const m of list) {
      if (!m.background || ids.has(m.id)) continue;
      ids.add(m.id);
      pool.push(m);
    }
  }
  return rotateDaily(pool, 10, seen);
}

export function kidsSpecs(key: string): RowSpec[] {
  return [
    {
      key: "trending-kids",
      title: "Trending for Kids",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_genres: "10751,16",
          "vote_count.gte": "200",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_MOVIE,
        }),
    },
    {
      key: "animated-movies",
      title: "Animated Movies",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_genres: "16",
          "vote_count.gte": "150",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_MOVIE,
        }),
    },
    {
      key: "g-pg-picks",
      title: "G and PG Picks",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          "vote_count.gte": "100",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_MOVIE,
          with_genres: "10751",
          without_genres: "16,27,53",
        }),
    },
    {
      key: "kids-tv",
      title: "Kids TV",
      fetcher: (p) =>
        tmdbDiscover(key, "tv", {
          with_genres: "10762",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_TV,
        }),
    },
    {
      key: "family-tv",
      title: "Family TV Nights",
      fetcher: (p) =>
        tmdbDiscover(key, "tv", {
          with_genres: "10751",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_TV,
        }),
    },
    {
      key: "adventures-kids",
      title: "Adventures",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_genres: "12,10751",
          "vote_count.gte": "120",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_MOVIE,
        }),
    },
    {
      key: "sing-along-kids",
      title: "Sing-Along and Musicals",
      fetcher: (p) =>
        tmdbDiscover(key, "movie", {
          with_genres: "10402,10751",
          "vote_count.gte": "50",
          sort_by: "popularity.desc",
          page: String(p),
          ...KID_MOVIE,
        }),
    },
  ];
}
