import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { buildAnimeHomeRows } from "@/views/home/home-rows";
import { buildArabicHomeRows } from "@/lib/arabic/home-rows";
import { buildRussianHomeRows } from "@/lib/russian/home-rows";
import { buildTraktHomeRows } from "@/lib/trakt/home-rails";
import { useTrakt } from "@/lib/trakt/provider";
import { buildSimklHomeRows } from "@/lib/simkl/home-rails";
import { useSimkl } from "@/lib/simkl/provider";
import { buildLetterboxdHomeRows } from "@/lib/stremboxd/home-rails";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { useCustomLists } from "@/lib/custom-lists";
import { useCollectionRowsForPage } from "@/lib/page-collection-rows";
import { useMediaFavorites, type MediaEntry } from "@/lib/media-favorites";
import { useLocalWatchlist } from "@/lib/local-watchlist";
import { usePinnedRows } from "@/views/home/hooks/use-pinned-rows";
import { useSettings } from "@/lib/settings";
import { useUiLanguage } from "@/lib/i18n";

function listRow(key: string, name: string, metas: Meta[]): HomeRow {
  return { key, type: "movie", name, metas, page: 1, hasMore: false, noDedup: true };
}

function useAsyncRows(
  build: (() => Promise<HomeRow[]>) | null,
  deps: React.DependencyList,
): HomeRow[] {
  const [rows, setRows] = useState<HomeRow[]>([]);
  useEffect(() => {
    if (!build) {
      setRows([]);
      return;
    }
    let cancelled = false;
    build()
      .then((rs) => {
        if (!cancelled) setRows(rs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}

export type BpExtraRows = {
  before: HomeRow[];
  after: HomeRow[];
};

export function useBpExtraRows(): BpExtraRows {
  const { settings } = useSettings();
  const uiLang = useUiLanguage();
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const letterboxd = useLetterboxd();
  const classic = settings.homeMode === "classic";

  const animeRows = useAsyncRows(
    settings.hideContent.anime || classic ? null : () => buildAnimeHomeRows(),
    [settings.hideContent.anime, classic],
  );

  const arabicRows = useAsyncRows(
    uiLang !== "ar" || classic || !settings.tmdbKey
      ? null
      : () => buildArabicHomeRows(settings.tmdbKey),
    [uiLang, classic, settings.tmdbKey, settings.tmdbLanguage],
  );

  const russianRows = useAsyncRows(
    uiLang !== "ru" || classic || !settings.tmdbKey
      ? null
      : () => buildRussianHomeRows(settings.tmdbKey),
    [uiLang, classic, settings.tmdbKey, settings.tmdbLanguage],
  );

  const traktRows = useAsyncRows(
    traktConnected ? () => buildTraktHomeRows(settings.tmdbKey) : null,
    [traktConnected, settings.tmdbKey],
  );

  const simklRows = useAsyncRows(simklConnected ? () => buildSimklHomeRows(settings) : null, [
    simklConnected,
    settings.tmdbKey,
    settings.simklHomeRailsEnabled,
    settings.simklUpNextRailEnabled,
    settings.simklTrendingRailEnabled,
    settings.simklGranularFilters,
  ]);

  const lbReady =
    letterboxd.isActive &&
    !(letterboxd.mode === "full" && !letterboxd.session) &&
    !(letterboxd.mode === "public" && !letterboxd.configSegment);
  const letterboxdRows = useAsyncRows(
    lbReady
      ? () =>
          buildLetterboxdHomeRows({
            configSegment: letterboxd.configSegment,
            selectedCatalogs: letterboxd.selectedCatalogs,
            hiddenCatalogs: letterboxd.hiddenCatalogs,
            catalogOrder: letterboxd.catalogOrder,
            session: letterboxd.session,
            listRefs: letterboxd.listRefs,
          })
      : null,
    [
      lbReady,
      letterboxd.configSegment,
      letterboxd.selectedCatalogs,
      letterboxd.hiddenCatalogs,
      letterboxd.catalogOrder,
      letterboxd.session,
      letterboxd.listRefs,
    ],
  );

  const { items: favItems } = useMediaFavorites();
  const { items: localItems } = useLocalWatchlist();
  const personalRows = useMemo<HomeRow[]>(() => {
    const toMetas = (m: Map<string, MediaEntry>): Meta[] =>
      [...m.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({ id: e.id, type: e.type, name: e.name, poster: e.poster }));
    const out: HomeRow[] = [];
    if (favItems.size > 0) out.push(listRow("harbor-favorites", "Favorites", toMetas(favItems)));
    if (localItems.size > 0)
      out.push(listRow("harbor-watchlist", "My Watchlist", toMetas(localItems)));
    return out;
  }, [favItems, localItems]);

  const customLists = useCustomLists();
  const listHomeRows = useMemo<HomeRow[]>(() => {
    const ids = settings.homeRows.listRows ?? [];
    if (ids.length === 0) return [];
    const byId = new Map(customLists.map((l) => [l.id, l]));
    const out: HomeRow[] = [];
    for (const id of ids) {
      const l = byId.get(id);
      if (!l || l.items.length === 0) continue;
      out.push(
        listRow(
          `list-${l.id}`,
          l.name,
          l.items.map((it) => ({ id: it.id, type: it.type, name: it.name, poster: it.poster })),
        ),
      );
    }
    return out;
  }, [customLists, settings.homeRows.listRows]);

  const homeCollections = useCollectionRowsForPage("home");
  const collectionHomeRows = useMemo<HomeRow[]>(
    () =>
      homeCollections
        .filter((c) => c.items.length > 0)
        .map((c) =>
          listRow(
            `collection-${c.id}`,
            c.name,
            c.items.map((it) => ({ id: it.id, type: it.type, name: it.name, poster: it.poster })),
          ),
        ),
    [homeCollections],
  );

  const pinnedRows = usePinnedRows();

  return useMemo(
    () => ({
      before: [...listHomeRows, ...collectionHomeRows, ...pinnedRows, ...arabicRows, ...russianRows],
      after: [
        ...personalRows,
        ...traktRows,
        ...simklRows,
        ...letterboxdRows,
        ...animeRows,
      ],
    }),
    [
      listHomeRows,
      collectionHomeRows,
      pinnedRows,
      arabicRows,
      russianRows,
      personalRows,
      traktRows,
      simklRows,
      letterboxdRows,
      animeRows,
    ],
  );
}
