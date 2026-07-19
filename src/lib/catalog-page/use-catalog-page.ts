import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { CATALOG_REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/progressive-rows";
import { advanceRowPage, mergeRowPage, type RowPageState } from "./merge";
import type { CatalogPageId, CatalogPageRow, CatalogRowSpec } from "./types";

const STALE_MS = 5 * 60_000;
const GC_MS = 30 * 60_000;
const DEFAULT_MIN_VISIBLE = 14;

export function catalogRowKey(
  pageId: CatalogPageId,
  scope: string,
  rowKey: string,
  pageNum: number,
) {
  return ["harbor", "catalog-page", pageId, scope, rowKey, pageNum] as const;
}

export function catalogHeroKey(pageId: CatalogPageId, scope: string) {
  return ["harbor", "catalog-page", pageId, scope, "hero"] as const;
}

export function rowFromSpec(spec: CatalogRowSpec, metas: Meta[], page = 1): CatalogPageRow {
  const min = spec.minVisible ?? DEFAULT_MIN_VISIBLE;
  return {
    key: spec.key,
    title: spec.title,
    metas,
    page,
    hasMore: !spec.noPaginate && metas.length >= min,
    ready: true,
    fetcher: spec.noPaginate ? undefined : spec.fetcher,
  };
}

export type UseCatalogPageOptions = {
  pageId: CatalogPageId;
  /** Cache partition (e.g. tmdbKey+region or "jikan"). */
  scope: string;
  specs: CatalogRowSpec[];
  heroFetcher?: () => Promise<Meta[]>;
  /** When false, queries stay dormant (keep-alive off-screen). Default true. */
  enabled?: boolean;
  maxPerRow?: number;
  mapMetas?: (metas: Meta[], key: string) => Meta[];
};

/**
 * Shared catalog loader for Movies / Shows / Kids / Anime.
 * Uses TanStack Query `useQueries` so rows stay cached, never wipe on
 * remount, and preload via `queryClient.prefetchQuery`.
 */
export function useCatalogPage(options: UseCatalogPageOptions) {
  const { pageId, scope, specs, heroFetcher, enabled = true, maxPerRow = 30, mapMetas } = options;
  const queryClient = useQueryClient();
  const loadingKeys = useRef(new Set<string>());
  // Loaded page per row. The merged page-1 cache entry drives the UI, so real
  // page numbers live here — keyed by scope to stay correct across key changes.
  const [pages, setPages] = useState<Record<string, RowPageState>>({});

  const live = enabled && !!scope && specs.length > 0;

  const heroQuery = useQuery({
    queryKey: catalogHeroKey(pageId, scope),
    queryFn: async () => {
      if (!heroFetcher) return [] as Meta[];
      return withTimeout(heroFetcher(), CATALOG_REQUEST_TIMEOUT_MS);
    },
    enabled: live && !!heroFetcher,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    retry: 1,
  });

  const rowQueries = useQueries({
    queries: specs.map((spec) => ({
      queryKey: catalogRowKey(pageId, scope, spec.key, 1),
      queryFn: async () => {
        let metas = await withTimeout(spec.fetcher(1), CATALOG_REQUEST_TIMEOUT_MS);
        if (mapMetas) metas = mapMetas(metas, spec.key);
        return metas;
      },
      enabled: live,
      staleTime: STALE_MS,
      gcTime: GC_MS,
      retry: 1,
    })),
  });

  const hero = heroQuery.data ?? [];

  const rows: CatalogPageRow[] = useMemo(() => {
    const out: CatalogPageRow[] = [];
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const metas = rowQueries[i]?.data;
      if (!metas || metas.length === 0) continue;
      const row = rowFromSpec(spec, metas, 1);
      const p = pages[`${scope}:${spec.key}`];
      if (p) {
        row.page = p.page;
        row.hasMore = row.fetcher != null && p.hasMore;
      }
      out.push(row);
    }
    return out;
  }, [specs, rowQueries, pages, scope]);

  const rowsByKey = useMemo(() => {
    const map: Record<string, CatalogPageRow> = {};
    for (const r of rows) map[r.key] = r;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      if (map[s.key]) continue;
      const q = rowQueries[i];
      const pending = q?.isPending || q?.isFetching;
      map[s.key] = {
        key: s.key,
        title: s.title,
        metas: [],
        page: 1,
        hasMore: false,
        ready: !pending && (q?.isFetched ?? false),
        fetcher: s.noPaginate ? undefined : s.fetcher,
      };
    }
    return map;
  }, [rows, specs, rowQueries]);

  const loading =
    live && (heroQuery.isLoading || rowQueries.some((q) => q.isLoading)) && rows.length === 0;

  const loadMore = useCallback(
    (rowKey: string) => {
      if (loadingKeys.current.has(rowKey)) return;
      const spec = specs.find((s) => s.key === rowKey);
      const row = rows.find((r) => r.key === rowKey);
      if (!spec || !row?.fetcher || !row.hasMore || row.metas.length >= maxPerRow) return;
      loadingKeys.current.add(rowKey);
      const next = row.page + 1;
      void queryClient
        .fetchQuery({
          queryKey: catalogRowKey(pageId, scope, rowKey, next),
          queryFn: async () => {
            let more = await withTimeout(spec.fetcher(next), CATALOG_REQUEST_TIMEOUT_MS);
            if (mapMetas) more = mapMetas(more, rowKey);
            return more;
          },
          staleTime: STALE_MS,
        })
        .then((more) => {
          // Merge page N into the page-1 cache entry that drives the UI.
          const baseKey = catalogRowKey(pageId, scope, rowKey, 1);
          const current = queryClient.getQueryData<Meta[]>(baseKey) ?? row.metas;
          const combined = mergeRowPage(current, more, maxPerRow);
          queryClient.setQueryData(baseKey, combined);
          setPages((prev) => ({
            ...prev,
            [`${scope}:${rowKey}`]: advanceRowPage(
              prev[`${scope}:${rowKey}`],
              more.length,
              combined.length,
              spec.minVisible ?? DEFAULT_MIN_VISIBLE,
              maxPerRow,
            ),
          }));
        })
        .catch(() => {})
        .finally(() => {
          loadingKeys.current.delete(rowKey);
        });
    },
    [mapMetas, maxPerRow, pageId, queryClient, rows, scope, specs],
  );

  return {
    hero,
    rows,
    rowsByKey,
    loadMore,
    loading,
    /** True while any row query is in flight (including background). */
    fetching: rowQueries.some((q) => q.isFetching) || heroQuery.isFetching,
  };
}

/** Prefetch first rows (+ optional hero) for a page (idle warmup / nav intent). */
export async function preloadCatalogPage(
  queryClient: ReturnType<typeof useQueryClient>,
  opts: {
    pageId: CatalogPageId;
    scope: string;
    specs: CatalogRowSpec[];
    heroFetcher?: () => Promise<Meta[]>;
    limit?: number;
  },
): Promise<void> {
  const { pageId, scope, specs, heroFetcher, limit = 8 } = opts;
  if (!scope) return;
  if (heroFetcher) {
    void queryClient.prefetchQuery({
      queryKey: catalogHeroKey(pageId, scope),
      queryFn: () => withTimeout(heroFetcher(), CATALOG_REQUEST_TIMEOUT_MS),
      staleTime: STALE_MS,
    });
  }
  await Promise.all(
    specs.slice(0, limit).map((spec) =>
      queryClient.prefetchQuery({
        queryKey: catalogRowKey(pageId, scope, spec.key, 1),
        queryFn: () => withTimeout(spec.fetcher(1), CATALOG_REQUEST_TIMEOUT_MS),
        staleTime: STALE_MS,
      }),
    ),
  );
}
