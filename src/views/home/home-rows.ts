import { createAddonCatalogFetcher, normalizeName, type AddonRow } from "@/lib/addons";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import {
  jikanNewReleases,
  jikanTopAiring,
  jikanTopPopular,
  jikanUpcoming,
  stripFranchiseSuffix,
} from "@/lib/providers/jikan";
import { tmdbMovieRow, tmdbSeriesRow, tmdbTrending } from "@/lib/providers/tmdb";
import { type Settings } from "@/lib/settings";
import type { HomeRow, RowSpec } from "./home-types";

export const MAX_PER_ROW = 30;

export function buildTmdbSpecs(settings: Settings): RowSpec[] {
  const key = settings.tmdbKey;
  const region = settings.region;
  return [
    {
      key: "tmdb-trending-movies",
      type: "movie",
      name: "Trending This Week",
      fetcher: (p) => tmdbTrending(key, "movie", "week", p),
    },
    {
      key: "tmdb-now-playing",
      type: "movie",
      name: "In Theaters Now",
      noDedup: true,
      fetcher: (p) => tmdbMovieRow(key, "now_playing", region, p),
    },
    {
      key: "tmdb-popular-movies",
      type: "movie",
      name: "Popular Movies",
      fetcher: (p) => tmdbMovieRow(key, "popular", region, p),
    },
    {
      key: "tmdb-trending-tv",
      type: "series",
      name: "Trending Series",
      fetcher: (p) => tmdbTrending(key, "tv", "week", p),
    },
    {
      key: "tmdb-on-the-air",
      type: "series",
      name: "On The Air",
      noDedup: true,
      fetcher: (p) => tmdbSeriesRow(key, "on_the_air", p),
    },
    {
      key: "tmdb-popular-tv",
      type: "series",
      name: "Popular Series",
      fetcher: (p) => tmdbSeriesRow(key, "popular", p),
    },
    {
      key: "tmdb-top-rated-tv",
      type: "series",
      name: "Top Rated Series",
      fetcher: (p) => tmdbSeriesRow(key, "top_rated", p),
    },
    {
      key: "tmdb-top-rated-movies",
      type: "movie",
      name: "Top Rated Movies",
      fetcher: (p) => tmdbMovieRow(key, "top_rated", region, p),
    },
  ];
}

export async function buildTmdbRows(settings: Settings) {
  const specs = buildTmdbSpecs(settings);
  const firstPages = await Promise.all(specs.map((s) => s.fetcher(1).catch(() => [] as Meta[])));
  const rows: HomeRow[] = specs
    .map((spec, i) => ({
      key: spec.key,
      type: spec.type,
      name: spec.name,
      metas: firstPages[i],
      page: 1,
      hasMore: firstPages[i].length > 0,
      noDedup: spec.noDedup,
      fetcher: spec.fetcher,
    }))
    .filter((r) => r.metas.length > 0);

  const byKey = (k: string) => rows.find((r) => r.key === k)?.metas ?? [];
  const hero = [
    byKey("tmdb-trending-movies")[0],
    byKey("tmdb-trending-tv")[0],
    byKey("tmdb-now-playing")[0],
    byKey("tmdb-on-the-air")[0],
  ].filter(Boolean) as Meta[];
  return { rows, hero };
}

export async function buildCinemetaRows() {
  const [
    movies,
    series,
    mDrama,
    mComedy,
    mAction,
    mScifi,
    mThriller,
    mAnimation,
    mHorror,
    mRomance,
    mAdventure,
    mDocumentary,
    mMystery,
    mFantasy,
    sDrama,
    sComedy,
    sCrime,
  ] = await Promise.all([
    topMovies().catch(() => [] as Meta[]),
    topSeries().catch(() => [] as Meta[]),
    topMovies("Drama").catch(() => [] as Meta[]),
    topMovies("Comedy").catch(() => [] as Meta[]),
    topMovies("Action").catch(() => [] as Meta[]),
    topMovies("Sci-Fi").catch(() => [] as Meta[]),
    topMovies("Thriller").catch(() => [] as Meta[]),
    topMovies("Animation").catch(() => [] as Meta[]),
    topMovies("Horror").catch(() => [] as Meta[]),
    topMovies("Romance").catch(() => [] as Meta[]),
    topMovies("Adventure").catch(() => [] as Meta[]),
    topMovies("Documentary").catch(() => [] as Meta[]),
    topMovies("Mystery").catch(() => [] as Meta[]),
    topMovies("Fantasy").catch(() => [] as Meta[]),
    topSeries("Drama").catch(() => [] as Meta[]),
    topSeries("Comedy").catch(() => [] as Meta[]),
    topSeries("Crime").catch(() => [] as Meta[]),
  ]);
  const make = (key: string, type: "movie" | "series", name: string, metas: Meta[]): HomeRow => ({
    key,
    type,
    name,
    metas,
    page: 1,
    hasMore: false,
  });
  const rows: HomeRow[] = [
    make("cm-top-movies", "movie", "Top 10 on Stremio", movies.slice(0, 10)),
    make("cm-popular", "movie", "Popular Movies", movies.slice(10, 40)),
    make("cm-drama", "movie", "Top 10 Drama", mDrama.slice(0, 10)),
    make("cm-trending-tv", "series", "Trending Series", series.slice(0, 30)),
    make("cm-comedy", "movie", "Top 10 Comedy", mComedy.slice(0, 10)),
    make("cm-action", "movie", "Action Hits", mAction.slice(0, 30)),
    make("cm-scifi", "movie", "Sci-Fi & Fantasy", mScifi.slice(0, 30)),
    make("cm-thriller", "movie", "Thrillers", mThriller.slice(0, 30)),
    make("cm-animation", "movie", "Animated Movies", mAnimation.slice(0, 30)),
    make("cm-horror", "movie", "Horror", mHorror.slice(0, 30)),
    make("cm-romance", "movie", "Romance", mRomance.slice(0, 30)),
    make("cm-adventure", "movie", "Adventure", mAdventure.slice(0, 30)),
    make("cm-documentary", "movie", "Documentaries", mDocumentary.slice(0, 30)),
    make("cm-mystery", "movie", "Mystery", mMystery.slice(0, 30)),
    make("cm-fantasy", "movie", "Fantasy", mFantasy.slice(0, 30)),
    make("cm-drama-tv", "series", "Drama Series", sDrama.slice(0, 30)),
    make("cm-comedy-tv", "series", "Comedy Series", sComedy.slice(0, 30)),
    make("cm-crime-tv", "series", "Crime Series", sCrime.slice(0, 30)),
  ].filter((r) => r.metas.length > 0);
  const hero = [movies[0], series[0], mDrama[0], mComedy[0], mAction[0], mScifi[0]].filter(
    Boolean,
  ) as Meta[];
  return { rows, hero };
}

export async function buildAnimeHomeRows(): Promise<HomeRow[]> {
  const cleanMetas = (list: Meta[]): Meta[] =>
    list.map((m) => {
      const cleaned = stripFranchiseSuffix(m.name);
      return cleaned === m.name ? m : { ...m, name: cleaned };
    });
  const fetchMany = async (
    fn: (page: number) => Promise<Meta[]>,
    pages: number,
  ): Promise<Meta[]> => {
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) => fn(i + 1).catch(() => [] as Meta[])),
    );
    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const list of results) {
      for (const m of list) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
      }
    }
    return out;
  };
  try {
    const [airing, newest, popular, upcoming] = await Promise.all([
      fetchMany(jikanTopAiring, 3),
      fetchMany(jikanNewReleases, 3),
      fetchMany(jikanTopPopular, 3),
      fetchMany(jikanUpcoming, 3),
    ]);
    const out: HomeRow[] = [];
    if (airing.length >= 6) {
      out.push({
        key: "anime-airing",
        type: "series",
        name: "Trending Anime",
        metas: cleanMetas(airing).slice(0, 60),
        page: 3,
        hasMore: false,
        noDedup: true,
      });
    }
    if (newest.length >= 6) {
      out.push({
        key: "anime-new",
        type: "series",
        name: "New Anime Releases",
        metas: cleanMetas(newest).slice(0, 60),
        page: 3,
        hasMore: false,
        noDedup: true,
      });
    }
    if (popular.length >= 6) {
      out.push({
        key: "anime-popular",
        type: "series",
        name: "Popular Anime",
        metas: cleanMetas(popular).slice(0, 60),
        page: 3,
        hasMore: false,
        noDedup: true,
      });
    }
    if (upcoming.length >= 6) {
      out.push({
        key: "anime-upcoming",
        type: "series",
        name: "Upcoming Anime",
        metas: cleanMetas(upcoming).slice(0, 60),
        page: 3,
        hasMore: false,
        noDedup: true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

const STREAMING_SERVICE_PATTERNS = [
  /\bnetflix\b/,
  /\bdisney\s*\+?\b/,
  /\bdisney\s*plus\b/,
  /\bhulu\b/,
  /\bprime\s*video\b/,
  /\bamazon\s*prime\b/,
  /\bapple\s*tv\s*\+?\b/,
  /\bappletv\b/,
  /\bhbo\s*max\b/,
  /\bmax\b/,
  /\bparamount\s*\+?\b/,
  /\bpeacock\b/,
  /\bstarz\b/,
  /\bshowtime\b/,
  /\bcrunchyroll\b/,
];

export function isStreamingServiceRow(name: string): boolean {
  const n = (name ?? "").toLowerCase();
  return STREAMING_SERVICE_PATTERNS.some((rx) => rx.test(n));
}

export function mergeRows(
  built: HomeRow[],
  addons: AddonRow[],
  opts: { dedup?: boolean } = {},
): HomeRow[] {
  const dedup = opts.dedup ?? true;
  const addonTypesByName = new Map<string, Set<string>>();
  for (const addon of addons) {
    const name = addon.name.trim().toLowerCase();
    const types = addonTypesByName.get(name) ?? new Set<string>();
    types.add(addon.type);
    addonTypesByName.set(name, types);
  }
  const seen = new Set<string>();
  const out: HomeRow[] = [];
  for (const r of built) {
    if (dedup) seen.add(normalizeName(r.name, r.type));
    out.push(r);
  }
  for (const a of addons) {
    if (dedup) {
      const key = normalizeName(a.name, a.type);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const step = a.metas.length;
    const more = a.more;
    const origin = a.metas[0]?.addonOrigin;
    const canPage = !!more && step > 0;
    const sameNameTypes = addonTypesByName.get(a.name.trim().toLowerCase());
    const name =
      sameNameTypes && sameNameTypes.size > 1
        ? `${a.name}: ${a.type === "movie" ? "Movies" : a.type === "series" ? "Series" : a.type}`
        : a.name;
    out.push({
      key: a.key,
      type: a.type as "movie" | "series",
      name,
      metas: a.metas,
      page: 1,
      hasMore: canPage,
      fetcher:
        canPage && more
          ? createAddonCatalogFetcher(more, {
              initialPageSize: step,
              mapMeta: origin ? (m) => ({ ...m, addonOrigin: origin }) : undefined,
            })
          : undefined,
    });
  }
  return out;
}
