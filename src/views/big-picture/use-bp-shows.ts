import { useCallback, useEffect, useMemo, useState } from "react";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import type { BpTileShape } from "./bp-tile";
import { useHideAnimeMetas, useHideAnimeRows } from "@/lib/anime-hide";
import { listPager } from "@/lib/list-pager";
import { useCollectionRowsForPage } from "@/lib/page-collection-rows";
import { applyPageRows, loadPageRows } from "@/lib/page-rows";
import { CATALOG_REQUEST_TIMEOUT_MS, upsertOrdered, withTimeout } from "@/lib/progressive-rows";
import { recentlyPlayed } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";
import { useBpTop10Feed } from "./bp-top10-feed";
import { buildShowHero } from "@/views/shows/hero-curation";
import { showSpecs } from "@/views/shows/show-specs";
import {
  buildMovieHero,
  HERO_POOL_TARGET,
  movieSpecs,
  rotateDaily,
} from "@/views/movies/movie-specs";

export type BpCatalogKind = "shows" | "movies";
export type BpCatalogPage = {
  rows: HomeRow[];
  hero: Meta[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
};

export type BpShowsPage = BpCatalogPage & {
  runtimeTitleKeys: ReadonlySet<string>;
};

export const BP_TOP10_ROW_KEY = "bp-top10";

const FALLBACK_ROW_CAP = 30;
const HERO_SLOTS = 6;
const MIN_ROW_METAS = 4;
const PAGINATE_THRESHOLD = 14;

type PageSpec = {
  key: string;
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  noPaginate?: boolean;
};

type Built = { rows: HomeRow[]; hero: Meta[] };

const EMPTY: Built = { rows: [], hero: [] };
const NO_METAS: Meta[] = [];
const cache = new Map<string, Built>();

const FALLBACK_GENRES: Record<BpCatalogKind, string[]> = {
  shows: [
    "Drama",
    "Comedy",
    "Crime",
    "Sci-Fi",
    "Thriller",
    "Mystery",
    "Action",
    "Animation",
    "Adventure",
    "Fantasy",
    "Documentary",
    "Romance",
    "Horror",
  ],
  movies: [
    "Action",
    "Drama",
    "Comedy",
    "Sci-Fi",
    "Thriller",
    "Horror",
    "Romance",
    "Animation",
    "Adventure",
    "Crime",
    "Mystery",
    "Fantasy",
    "Documentary",
  ],
};

function metaType(kind: BpCatalogKind): "movie" | "series" {
  return kind === "shows" ? "series" : "movie";
}

function specsFor(kind: BpCatalogKind, key: string, region: string): PageSpec[] {
  return kind === "shows" ? showSpecs(key) : movieSpecs(key, region);
}

function heroFor(kind: BpCatalogKind, key: string): Promise<Meta[]> {
  return kind === "shows" ? buildShowHero(key) : buildMovieHero(key, recentlyPlayed());
}

function specRow(kind: BpCatalogKind, spec: PageSpec, metas: Meta[]): HomeRow {
  return {
    key: spec.key,
    type: metaType(kind),
    name: spec.title,
    metas,
    page: 1,
    hasMore: !spec.noPaginate && metas.length >= PAGINATE_THRESHOLD,
    fetcher: spec.noPaginate ? undefined : spec.fetcher,
  };
}

async function buildFallback(kind: BpCatalogKind): Promise<Built> {
  const fetchTop = kind === "shows" ? topSeries : topMovies;
  const genres = FALLBACK_GENRES[kind];
  const [top, ...byGenre] = await Promise.all([
    withTimeout(fetchTop(), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
    ...genres.map((g) =>
      withTimeout(fetchTop(g), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
    ),
  ]);
  const type = metaType(kind);
  const paged = (list: Meta[]) => (kind === "movies" ? listPager(list) : undefined);
  const rows: HomeRow[] = [];
  if (top.length > 0) {
    rows.push({
      key: "cinemeta-top",
      type,
      name: kind === "shows" ? "Top Series" : "Top Movies",
      metas: top.slice(0, FALLBACK_ROW_CAP),
      page: 1,
      hasMore: false,
      fetcher: paged(top),
    });
  }
  for (let i = 0; i < genres.length; i++) {
    const list = byGenre[i] ?? [];
    if (list.length === 0) continue;
    rows.push({
      key: `cinemeta-genre-${genres[i].toLowerCase().replace(/[^a-z]/g, "")}`,
      type,
      name: `Top ${genres[i]}`,
      metas: list.slice(0, FALLBACK_ROW_CAP),
      page: 1,
      hasMore: false,
      fetcher: paged(list),
    });
  }
  const withArt = top.filter((m) => m.background);
  const hero =
    kind === "movies"
      ? rotateDaily(withArt, HERO_POOL_TARGET, recentlyPlayed())
      : withArt.slice(0, HERO_SLOTS);
  return { rows, hero };
}

function useBuiltCatalog(kind: BpCatalogKind): {
  built: Built;
  loading: boolean;
  failed: boolean;
  retry: () => void;
} {
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey;
  const region = settings.region;
  const cacheKey = `${kind}:${tmdbKey}:${kind === "movies" ? region : ""}`;
  const primed = cache.get(cacheKey) ?? null;
  const [built, setBuilt] = useState<Built>(primed ?? EMPTY);
  const [loading, setLoading] = useState(!primed);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const hit = cache.get(cacheKey);
    if (hit) {
      setBuilt(hit);
      setLoading(false);
      setFailed(false);
      return;
    }
    let cancelled = false;
    let acc: Built = EMPTY;
    let settled = false;
    setBuilt(EMPTY);
    setLoading(true);
    setFailed(false);

    const commit = (next: Built) => {
      acc = next;
      setBuilt(next);
      if (settled) cache.set(cacheKey, next);
    };

    (async () => {
      if (tmdbKey) {
        const specs = specsFor(kind, tmdbKey, region);
        const order = specs.map((spec) => spec.key);
        void withTimeout(heroFor(kind, tmdbKey), CATALOG_REQUEST_TIMEOUT_MS)
          .then((hero) => {
            if (!cancelled) commit({ ...acc, hero });
          })
          .catch(() => {});
        const results = await Promise.allSettled(
          specs.map(async (spec) => {
            const metas = await withTimeout(spec.fetcher(1), CATALOG_REQUEST_TIMEOUT_MS);
            if (cancelled || metas.length === 0) return false;
            commit({ ...acc, rows: upsertOrdered(acc.rows, specRow(kind, spec, metas), order) });
            return true;
          }),
        );
        if (cancelled) return;
        if (results.some((r) => r.status === "fulfilled" && r.value)) {
          settled = true;
          cache.set(cacheKey, acc);
          setLoading(false);
          return;
        }
      }
      const fallback = await buildFallback(kind);
      if (cancelled) return;
      settled = true;
      // A build with nothing in it is not an answer. Caching it would pin the
      // failure screen for the rest of the session.
      if (fallback.rows.length > 0) cache.set(cacheKey, fallback);
      commit(fallback);
      setFailed(fallback.rows.length === 0);
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setFailed(true);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, kind, tmdbKey, region, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { built, loading, failed, retry };
}

export function useBpCatalogPage(kind: BpCatalogKind): BpCatalogPage {
  const { built, loading, failed, retry } = useBuiltCatalog(kind);
  const collections = useCollectionRowsForPage(kind);
  const custom = useMemo(() => loadPageRows(kind), [kind]);
  const hero = useHideAnimeMetas(built.hero);
  const trending = useMemo(
    () => built.rows.find((r) => r.key === "trending")?.metas ?? [],
    [built.rows],
  );
  const trendingShown = useHideAnimeMetas(trending);
  const ranked = useMemo(() => {
    const top = trendingShown.slice(0, 10);
    return top.length >= 10 ? top : NO_METAS;
  }, [trendingShown]);
  useBpTop10Feed(ranked);

  const collectionRows = useMemo<HomeRow[]>(
    () =>
      collections
        .filter((c) => c.items.length > 0)
        .map((c) => ({
          key: `collection-${c.id}`,
          type: metaType(kind),
          name: c.name,
          metas: c.items.map((it) => ({
            id: it.id,
            type: it.type,
            name: it.name,
            poster: it.poster,
          })),
          page: 1,
          hasMore: false,
        })),
    [collections, kind],
  );

  // The hero pool is deliberately not seeded into the dedupe. Big Picture never
  // renders a hero carousel, so dropping those titles would take them off the
  // page entirely.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    for (const m of ranked) seen.add(m.id);
    const specRows: HomeRow[] = [];
    for (const row of built.rows) {
      if (row.key === "trending" && ranked.length > 0) continue;
      const metas = row.metas.filter((m) => !seen.has(m.id));
      if (metas.length < MIN_ROW_METAS) continue;
      for (const m of metas) seen.add(m.id);
      specRows.push({ ...row, metas });
    }
    const titled = [...collectionRows, ...specRows].map((r) => ({ ...r, title: r.name }));
    const ordered = applyPageRows(titled, custom, false).map(({ title, ...rest }) => ({
      ...rest,
      name: title,
    }));
    if (ranked.length === 0) return ordered;
    const top: HomeRow = {
      key: BP_TOP10_ROW_KEY,
      type: metaType(kind),
      name: kind === "shows" ? "Top 10 Series Today" : "Top 10 Movies Today",
      metas: ranked,
      page: 1,
      hasMore: false,
    };
    return [top, ...ordered];
  }, [built.rows, ranked, collectionRows, custom, kind]);

  return { rows: useHideAnimeRows(rows), hero, loading, failed, retry };
}

export function useBpShows(): BpShowsPage {
  const page = useBpCatalogPage("shows");
  const custom = useMemo(() => loadPageRows("shows"), []);
  const runtimeTitleKeys = useMemo(
    () =>
      new Set(
        page.rows
          .filter(
            (row) =>
              row.key.startsWith("collection-") ||
              row.sourceRow != null ||
              custom.renamed[row.key] != null,
          )
          .map((row) => row.key),
      ),
    [page.rows, custom],
  );

  return { ...page, runtimeTitleKeys };
}

/**
 * The ranked row is ranked by STRUCTURE, not by preference.
 *
 * bp-row's bpRowShape answers "rank" only for a row key the user put in
 * settings.homeRows.numerals, and the only UI that writes that set is desktop's
 * home row edit mode. Big Picture exposes nothing for it, so on a television the
 * numbered row could never appear however the page was built. This row is built
 * by useBpCatalogPage, is always exactly ten, and is titled Top 10, so it does
 * not ask.
 *
 * Do NOT "fix" the general case by teaching Big Picture to write
 * settings.homeRows.numerals. That set is desktop's per-row opt-in and a TV
 * write syncs back and reshapes the user's desktop home.
 */
export function bpCatalogShape(row: HomeRow): BpTileShape {
  return row.key === BP_TOP10_ROW_KEY ? "rank" : "poster";
}
