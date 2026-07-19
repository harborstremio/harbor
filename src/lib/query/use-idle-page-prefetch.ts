import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { preloadCatalogPage } from "@/lib/catalog-page";
import { fetchAddonsDirectory, fetchInstalledAddonsPair } from "@/lib/addons-store/store";
import { listBrowseCatalogs } from "@/lib/catalog-browse";
import { recentlyPlayed } from "@/lib/playback-history";
import { queryKeys } from "@/lib/query/keys";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { useAuth } from "@/lib/auth";
import { SPECS as ANIME_SPECS } from "@/views/anime/anime-rows";
import { prefetchCatalogShelf } from "@/views/catalogs/catalog-shelf";
import { prefetchDiscoverPage } from "@/views/discover/discover-queries";
import { kidsSpecs } from "@/views/kids/kids-specs";
import { buildMovieHero, movieSpecs } from "@/views/movies/movie-specs";
import { buildShowHero } from "@/views/shows/hero-curation";
import { showSpecs } from "@/views/shows/show-specs";

/** Rows warmed per page on intent/idle preload. */
const PRELOAD_LIMIT = 8;

/** Preload one nav page's first rows into TanStack Query (hover / focus / idle). */
export function preloadNavPage(
  queryClient: ReturnType<typeof useQueryClient>,
  view: string,
  tmdbKey: string,
  region: string,
  authKey: string | null = null,
  settings?: Settings,
): void {
  if (view === "discover") {
    if (settings) prefetchDiscoverPage(queryClient, settings);
    return;
  }
  if (view === "anime") {
    void preloadCatalogPage(queryClient, {
      pageId: "anime",
      scope: "jikan",
      specs: ANIME_SPECS.map((s) => ({ key: s.key, title: s.title, fetcher: s.fetcher })),
      limit: PRELOAD_LIMIT,
    });
    return;
  }
  if (view === "catalogs") {
    void queryClient
      .prefetchQuery({
        queryKey: queryKeys.catalog.list(authKey),
        queryFn: () => listBrowseCatalogs(authKey),
        staleTime: 5 * 60_000,
      })
      .then(() => {
        const list = queryClient.getQueryData<Awaited<ReturnType<typeof listBrowseCatalogs>>>(
          queryKeys.catalog.list(authKey),
        );
        if (!list?.length) return;
        for (const c of list.slice(0, PRELOAD_LIMIT)) prefetchCatalogShelf(queryClient, c);
      })
      .catch(() => {});
    return;
  }
  if (view === "addons") {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.addons.installed(authKey),
      queryFn: () => fetchInstalledAddonsPair(authKey),
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.addons.directory(),
      queryFn: fetchAddonsDirectory,
      staleTime: 60 * 60_000,
    });
    return;
  }
  if (!tmdbKey) return;
  const scope = `tmdb:${tmdbKey}:${region}`;
  if (view === "movies") {
    void preloadCatalogPage(queryClient, {
      pageId: "movies",
      scope,
      specs: movieSpecs(tmdbKey, region),
      heroFetcher: () => buildMovieHero(tmdbKey, recentlyPlayed()),
      limit: PRELOAD_LIMIT,
    });
  } else if (view === "shows") {
    void preloadCatalogPage(queryClient, {
      pageId: "shows",
      scope,
      specs: showSpecs(tmdbKey),
      heroFetcher: () => buildShowHero(tmdbKey),
      limit: PRELOAD_LIMIT,
    });
  } else if (view === "kids") {
    void preloadCatalogPage(queryClient, {
      pageId: "kids",
      scope: `tmdb:${tmdbKey}`,
      specs: kidsSpecs(tmdbKey),
      limit: PRELOAD_LIMIT,
    });
  }
}

const WARM_VIEWS = ["discover", "anime", "catalogs", "movies", "shows", "kids"] as const;

/** Idle warmup so the main catalog routes paint from cache on first open. */
export function useIdlePagePrefetch() {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const queryClient = useQueryClient();
  const tmdbKey = settings.tmdbKey;
  const region = settings.region;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const run = () => {
      if (cancelled) return;
      for (const view of WARM_VIEWS)
        preloadNavPage(queryClient, view, tmdbKey, region, authKey, settings);
    };

    const id =
      typeof win.requestIdleCallback === "function"
        ? win.requestIdleCallback(run, { timeout: 2500 })
        : window.setTimeout(run, 900);

    return () => {
      cancelled = true;
      if (typeof win.cancelIdleCallback === "function" && typeof id === "number") {
        win.cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
    };
  }, [tmdbKey, region, queryClient, authKey, settings]);
}
