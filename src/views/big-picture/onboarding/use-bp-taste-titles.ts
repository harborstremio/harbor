import { useEffect, useState } from "react";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { tmdbDiscover, tmdbTrending } from "@/lib/providers/tmdb";

const CAP = 40;

const GENRE_IDS = [
  "28",
  "35",
  "18",
  "878",
  "27",
  "53",
  "10749",
  "16",
  "14",
  "80",
  "37",
  "12",
  "9648",
  "99",
  "10752",
];
const GENRE_FALLBACK = ["Western", "Documentary", "Animation", "Crime", "Comedy"];

function mix(lists: Meta[][]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < CAP; i += 1) {
    for (const list of lists) {
      const m = list[i];
      if (m?.poster && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
        if (out.length >= CAP) break;
      }
    }
  }
  return out;
}

async function load(tmdbKey: string): Promise<Meta[]> {
  if (tmdbKey) {
    const [movies, series, ...byGenre] = await Promise.all([
      tmdbTrending(tmdbKey, "movie", "week").catch(() => [] as Meta[]),
      tmdbTrending(tmdbKey, "tv", "week").catch(() => [] as Meta[]),
      ...GENRE_IDS.map((id) =>
        tmdbDiscover(tmdbKey, "movie", {
          with_genres: id,
          sort_by: "popularity.desc",
          "vote_count.gte": "800",
          "vote_average.gte": "6.4",
        })
          .then((r) => r.slice(0, 2))
          .catch(() => [] as Meta[]),
      ),
    ]);
    const mixed = mix([movies, series, ...byGenre]);
    if (mixed.length >= 16) return mixed;
  }
  const [m, s, ...genreMovies] = await Promise.all([
    topMovies().catch(() => [] as Meta[]),
    topSeries().catch(() => [] as Meta[]),
    ...GENRE_FALLBACK.map((g) => topMovies(g).catch(() => [] as Meta[])),
  ]);
  return mix([m, s, ...genreMovies]);
}

export function useBpTasteTitles(tmdbKey: string): Meta[] | null {
  const [items, setItems] = useState<Meta[] | null>(null);
  useEffect(() => {
    let alive = true;
    void load(tmdbKey).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [tmdbKey]);
  return items;
}
