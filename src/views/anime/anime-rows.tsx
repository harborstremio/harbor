import type { Meta } from "@/lib/cinemeta";
import {
  GENRE,
  jikanAiringNow,
  jikanByEra,
  jikanByGenre,
  jikanTopAiring,
  jikanTopAnime,
  jikanTopMovies,
  jikanTopPopular,
  jikanTopTv,
  jikanUnderratedGems,
  jikanUpcoming,
} from "@/lib/providers/jikan";

export type RowPool = "general" | "era" | "genre";

export type Spec = {
  key: string;
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  rank?: boolean;
  pool?: RowPool;
};

export const SPECS: Spec[] = [
  { key: "airing", title: "Airing Now", fetcher: jikanAiringNow },
  { key: "top-airing", title: "Top Airing on MAL", fetcher: jikanTopAiring, rank: true },
  { key: "upcoming", title: "Upcoming Season", fetcher: jikanUpcoming },
  { key: "top-tv", title: "Top Series on MAL", fetcher: jikanTopTv, rank: true },
  { key: "top-movies", title: "Top Movies on MAL", fetcher: jikanTopMovies },
  { key: "popular", title: "Most Popular on MAL", fetcher: jikanTopPopular },
  { key: "all-time", title: "Top Rated on MAL", fetcher: jikanTopAnime },
  { key: "gems", title: "Hidden Gems on MAL", fetcher: jikanUnderratedGems },
  {
    key: "era-2020s",
    title: "2020s Hits",
    pool: "era",
    fetcher: (p) => jikanByEra("2020-01-01", "2029-12-31", p),
  },
  {
    key: "era-2010s",
    title: "2010s Classics",
    pool: "era",
    fetcher: (p) => jikanByEra("2010-01-01", "2019-12-31", p),
  },
  {
    key: "era-2000s",
    title: "2000s Era",
    pool: "era",
    fetcher: (p) => jikanByEra("2000-01-01", "2009-12-31", p),
  },
  {
    key: "era-1990s",
    title: "Foundation Years (90s)",
    pool: "era",
    fetcher: (p) => jikanByEra("1990-01-01", "1999-12-31", p),
  },
  {
    key: "genre-action",
    title: "Action & Adventure",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Action, p),
  },
  {
    key: "genre-romance",
    title: "Romance",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Romance, p),
  },
  {
    key: "genre-slice",
    title: "Slice of Life",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.SliceOfLife, p),
  },
  {
    key: "genre-mecha",
    title: "Mecha",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Mecha, p),
  },
  {
    key: "genre-fantasy",
    title: "Fantasy",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Fantasy, p),
  },
  {
    key: "genre-scifi",
    title: "Sci-Fi",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.SciFi, p),
  },
  {
    key: "genre-psych",
    title: "Psychological",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Psychological, p),
  },
  {
    key: "genre-horror",
    title: "Horror & Supernatural",
    pool: "genre",
    fetcher: (p) => jikanByGenre(GENRE.Horror, p),
  },
];

export const HERO_KEYS = new Set(["airing", "top-airing", "upcoming", "popular"]);
export const TOP_PICKS_KEY = "top-airing";

export const ROW_MIN_VISIBLE = 12;
export const ROW_MAX_PAGES = 5;

export type RowState = { metas: Meta[]; page: number; hasMore: boolean; ready: boolean };

export const EMPTY_ROW: RowState = { metas: [], page: 1, hasMore: false, ready: false };

export function RowSkeleton({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-[26px] font-medium text-ink/85">{title}</h2>
      </div>
      <div className="flex gap-5 overflow-hidden px-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 animate-pulse rounded-2xl bg-elevated/60"
            style={{ width: 144, aspectRatio: "2 / 3", animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
