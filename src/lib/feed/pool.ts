import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { tmdbDiscover, tmdbMovieRow, tmdbSeriesRow, tmdbTrending } from "@/lib/providers/tmdb";
import { DECADES, LANGUAGES, MOVIE_GENRES, dailySeed, pickRandom, shuffle } from "./tags";

export type FeedItem = {
  meta: Meta;
  tag: string;
  category: string;
};

const TAG_TRENDING = "Trending";
const TAG_TOP_RATED = "Top Rated";
const TAG_HIDDEN_GEM = "Hidden Gem";
const TAG_ACCLAIMED = "Acclaimed";
const TAG_CULT = "Cult Classic";
const TAG_SERIES = "Series";

let poolCache: { date: number; key: string; items: FeedItem[] } | null = null;
let poolInflight: { date: number; key: string; promise: Promise<FeedItem[]> } | null = null;

export async function getPool(tmdbKey: string): Promise<FeedItem[]> {
  const today = dailySeed();
  if (poolCache && poolCache.date === today && poolCache.key === tmdbKey) {
    return poolCache.items;
  }
  if (poolInflight && poolInflight.date === today && poolInflight.key === tmdbKey) {
    return poolInflight.promise;
  }
  const promise = buildPool(tmdbKey);
  poolInflight = { date: today, key: tmdbKey, promise };
  void promise
    .then((items) => {
      poolCache = { date: today, key: tmdbKey, items };
    })
    .catch(() => {})
    .finally(() => {
      if (poolInflight?.promise === promise) poolInflight = null;
    });
  return promise;
}

export async function buildPool(tmdbKey: string): Promise<FeedItem[]> {
  if (!tmdbKey) return buildFallbackPool();
  return buildTmdbPool(tmdbKey);
}

export async function extendPool(tmdbKey: string, page: number): Promise<FeedItem[]> {
  if (!tmdbKey) return [];
  const seed = dailySeed() + page;
  const genres = pickRandom(Object.keys(MOVIE_GENRES), 3, seed);
  const decades = pickRandom(DECADES, 2, seed + 1);
  const queries: Array<Promise<FeedItem[]>> = [
    tmdbTrending(tmdbKey, "movie", "week", page).then((m) => label(m, TAG_TRENDING, "trending_movies")),
    tmdbTrending(tmdbKey, "tv", "week", page).then((m) => label(m, TAG_TRENDING, "trending_series")),
    tmdbMovieRow(tmdbKey, "popular", "US", page).then((m) => label(m, TAG_TRENDING, "popular_movies")),
    tmdbMovieRow(tmdbKey, "top_rated", "US", page + 2).then((m) => label(m, TAG_TOP_RATED, "top_rated_movies")),
    tmdbSeriesRow(tmdbKey, "top_rated", page + 2).then((m) => label(m, TAG_SERIES, "top_rated_series")),
    ...genres.map((g) =>
      tmdbDiscover(tmdbKey, "movie", { ...genreParams(g), page: String(page) }).then((m) =>
        label(m, g, `genre_${g}`),
      ),
    ),
    ...decades.map((d) =>
      tmdbDiscover(tmdbKey, "movie", { ...decadeParams(d.from, d.to), page: String(page) }).then((m) =>
        label(m, `From the ${d.label}`, `decade_${d.label}`),
      ),
    ),
  ];
  const batches = await Promise.all(queries);
  const merged: FeedItem[] = [];
  for (const b of batches) merged.push(...b);
  return finalize(merged, seed);
}

async function buildTmdbPool(key: string): Promise<FeedItem[]> {
  const seed = dailySeed();

  const genres = pickRandom(Object.keys(MOVIE_GENRES), 4, seed);
  const decades = pickRandom(DECADES, 3, seed + 1);
  const languages = pickRandom(LANGUAGES, 2, seed + 2);

  const queries: Array<Promise<FeedItem[]>> = [
    tmdbTrending(key, "movie", "week", 1).then((m) => label(m, TAG_TRENDING, "trending_movies")),
    tmdbTrending(key, "movie", "week", 2).then((m) => label(m, TAG_TRENDING, "trending_movies")),
    tmdbTrending(key, "tv", "week", 1).then((m) => label(m, TAG_TRENDING, "trending_series")),
    tmdbMovieRow(key, "top_rated", "US", 1).then((m) => label(m, TAG_TOP_RATED, "top_rated_movies")),
    tmdbMovieRow(key, "top_rated", "US", 2).then((m) => label(m, TAG_TOP_RATED, "top_rated_movies")),
    tmdbMovieRow(key, "top_rated", "US", 3).then((m) => label(m, TAG_TOP_RATED, "top_rated_movies")),
    tmdbMovieRow(key, "popular", "US", 1).then((m) => label(m, TAG_TRENDING, "popular_movies")),
    tmdbSeriesRow(key, "top_rated", 1).then((m) => label(m, TAG_SERIES, "top_rated_series")),
    tmdbSeriesRow(key, "top_rated", 2).then((m) => label(m, TAG_SERIES, "top_rated_series")),
    tmdbDiscover(key, "movie", hiddenGemParams("1")).then((m) => label(m, TAG_HIDDEN_GEM, "hidden_gems")),
    tmdbDiscover(key, "movie", hiddenGemParams("2")).then((m) => label(m, TAG_HIDDEN_GEM, "hidden_gems")),
    tmdbDiscover(key, "movie", acclaimedParams()).then((m) => label(m, TAG_ACCLAIMED, "acclaimed")),
    tmdbDiscover(key, "movie", cultParams()).then((m) => label(m, TAG_CULT, "cult_classics")),
    ...genres.map((g) =>
      tmdbDiscover(key, "movie", genreParams(g)).then((m) => label(m, g, `genre_${g}`)),
    ),
    ...decades.map((d) =>
      tmdbDiscover(key, "movie", decadeParams(d.from, d.to)).then((m) =>
        label(m, `From the ${d.label}`, `decade_${d.label}`),
      ),
    ),
    ...languages.map((l) =>
      tmdbDiscover(key, "movie", languageParams(l.code)).then((m) =>
        label(m, l.label, `lang_${l.code}`),
      ),
    ),
  ];

  const batches = await Promise.all(queries);
  const merged: FeedItem[] = [];
  for (const b of batches) merged.push(...b);

  return finalize(merged, seed);
}

async function buildFallbackPool(): Promise<FeedItem[]> {
  const genres = ["Drama", "Comedy", "Action", "Crime", "Sci-Fi", "Thriller"];
  const queries: Array<Promise<FeedItem[]>> = [
    topMovies().then((m) => label(m, TAG_TRENDING, "cinemeta_top_movies")),
    topSeries().then((m) => label(m, TAG_SERIES, "cinemeta_top_series")),
    ...genres.map((g) => topMovies(g).then((m) => label(m, g, `cinemeta_genre_${g}`))),
  ];
  const batches = await Promise.all(queries);
  const merged: FeedItem[] = [];
  for (const b of batches) merged.push(...b);
  return finalize(merged, dailySeed());
}

function label(metas: Meta[], tag: string, category: string): FeedItem[] {
  return metas.map((meta) => ({ meta, tag, category }));
}

function finalize(items: FeedItem[], seed: number): FeedItem[] {
  const seen = new Set<string>();
  const filtered: FeedItem[] = [];
  for (const it of items) {
    if (seen.has(it.meta.id)) continue;
    if (!it.meta.poster) continue;
    seen.add(it.meta.id);
    filtered.push(it);
  }
  return interleave(shuffle(filtered, seed));
}

function interleave(items: FeedItem[]): FeedItem[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const it of items) {
    const list = buckets.get(it.category) ?? [];
    list.push(it);
    buckets.set(it.category, list);
  }
  const queues = [...buckets.values()];
  const out: FeedItem[] = [];
  let any = true;
  while (any) {
    any = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        any = true;
      }
    }
  }
  return out;
}

function hiddenGemParams(page: string): Record<string, string> {
  return {
    "vote_average.gte": "7.2",
    "vote_count.gte": "300",
    "vote_count.lte": "3500",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page,
  };
}

function acclaimedParams(): Record<string, string> {
  return {
    "vote_average.gte": "8.0",
    "vote_count.gte": "1000",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page: "1",
  };
}

function cultParams(): Record<string, string> {
  return {
    "primary_release_date.lte": "1999-12-31",
    "vote_average.gte": "7.4",
    "vote_count.gte": "300",
    "vote_count.lte": "5000",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page: "1",
  };
}

function genreParams(genre: string): Record<string, string> {
  return {
    with_genres: String(MOVIE_GENRES[genre]),
    "vote_average.gte": "6.8",
    "vote_count.gte": "200",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page: "1",
  };
}

function decadeParams(from: string, to: string): Record<string, string> {
  return {
    "primary_release_date.gte": from,
    "primary_release_date.lte": to,
    "vote_average.gte": "7.0",
    "vote_count.gte": "200",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page: "1",
  };
}

function languageParams(code: string): Record<string, string> {
  return {
    with_original_language: code,
    "vote_average.gte": "6.8",
    "vote_count.gte": "100",
    "with_runtime.gte": "70",
    sort_by: "vote_average.desc",
    page: "1",
  };
}
