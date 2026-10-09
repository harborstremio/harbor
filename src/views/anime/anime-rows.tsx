import type { AddonRow } from "@/lib/addons";
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
import { useSettings } from "@/lib/settings";

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
  { key: "genre-action", title: "Action & Adventure", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Action, p) },
  { key: "genre-romance", title: "Romance", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Romance, p) },
  { key: "genre-slice", title: "Slice of Life", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.SliceOfLife, p) },
  { key: "genre-mecha", title: "Mecha", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Mecha, p) },
  { key: "genre-fantasy", title: "Fantasy", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Fantasy, p) },
  { key: "genre-scifi", title: "Sci-Fi", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.SciFi, p) },
  { key: "genre-psych", title: "Psychological", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Psychological, p) },
  { key: "genre-horror", title: "Horror & Supernatural", pool: "genre", fetcher: (p) => jikanByGenre(GENRE.Horror, p) },
];

export const HERO_KEYS = new Set(["airing", "top-airing", "upcoming", "popular"]);
export const TOP_PICKS_KEY = "top-airing";

export const ROW_MIN_VISIBLE = 12;
export const ROW_MAX_PAGES = 5;

export type RowState = { metas: Meta[]; page: number; hasMore: boolean; ready: boolean; failed?: boolean };

export const EMPTY_ROW: RowState = { metas: [], page: 1, hasMore: false, ready: false };

export function isAnimeRow(row: AddonRow): boolean {
  if (row.type === "anime") return true;
  const nameLower = (row.name ?? "").toLowerCase();
  if (/\b(anime|mal|anilist|kitsu|aniworld|crunchyroll|funimation)\b/.test(nameLower)) return true;
  const sample = row.metas.slice(0, 6);
  if (sample.length === 0) return false;
  const animeIds = sample.filter(
    (m) => m.id.startsWith("kitsu:") || m.id.startsWith("mal:") || m.id.startsWith("anilist:"),
  ).length;
  return animeIds / sample.length >= 0.5;
}

export function RowSkeleton({ title, shape = "portrait" }: { title: string; shape?: "portrait" | "landscape" }) {
  const { settings } = useSettings();
  const landscape = shape === "landscape";
  const w = landscape ? 260 : Math.round(144 * settings.posterScale);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-[26px] font-medium text-ink/85">{title}</h2>
      </div>
      <div className="flex gap-5 overflow-hidden px-1">
        {Array.from({ length: landscape ? 8 : 14 }).map((_, i) => (
          <div
            key={i}
            className="harbor-skel flex-shrink-0 bg-elevated/50"
            style={{
              width: w,
              aspectRatio: landscape ? "16 / 9" : "2 / 3",
              borderRadius: landscape ? 14 : settings.posterRadius,
            }}
          />
        ))}
      </div>
    </div>
  );
}
