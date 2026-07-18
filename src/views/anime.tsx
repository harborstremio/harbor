import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimeGenrePicker } from "@/components/anime-genre-picker";
import { AnimeHero, AnimeHeroSkeleton } from "@/components/anime-hero";
import { BackToTop } from "@/components/back-to-top";
import { ContinueCard } from "@/components/continue-card";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { PickCard } from "@/components/pick-card";
import { Row, ScrollRootContext } from "@/components/row";
import { AnimeRankCard } from "@/components/top-rank-card";
import { useAuth } from "@/lib/auth";
import {
  createAddonCatalogFetcher,
  loadAddonRows,
  normalizeName,
  type AddonRow,
} from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import { awardFranchiseKey, uniqueWinnerFranchisesAcrossSources } from "@/lib/anime-awards";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { useT } from "@/lib/i18n";
import { useAnimeTopPicks } from "@/lib/use-anime-top-picks";
import { useCrunchyrollAwardMetas } from "@/lib/use-crunchyroll-award-metas";
import { useWatchHistoryRecommendations } from "@/lib/use-watch-history-recs";
import { AnilistRows } from "./anime/anilist-rows";
import { MalRows } from "./anime/mal-rows";
import { useCwAdvance } from "./home/hooks/use-cw-advance";
import { detectAnimeForCw, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { AnilistRowControls } from "./anime/anilist-row-controls";
import { MalRowControls } from "./anime/mal-row-controls";
import { AnilistTopRow, AnilistTrendingRow } from "./anime/anilist-top-row";
import { useCatalogPage, type CatalogRowSpec } from "@/lib/catalog-page";
import {
  EMPTY_ROW,
  ROW_MAX_PAGES,
  ROW_MIN_VISIBLE,
  RowSkeleton,
  SPECS,
  TOP_PICKS_KEY,
  type RowPool,
  type RowState,
} from "./anime/anime-rows";
import { isAnimeRow } from "@/lib/is-anime-row";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";
import { franchiseRoot, franchiseRootSync } from "@/lib/providers/anime-franchise-root";
import { animeFiltered, enrichAnimeCountry, type AnimeFilterOpts } from "@/lib/anime-filter";
import {
  buildHeroSelection,
  buildHostedHero,
  cacheHero,
  isHeroCacheFresh,
  readCachedHero,
  resolveHeroSlides,
  type HeroBuilt,
} from "./anime/hero-build";
import { fetchHostedHero, peekHostedHero, type HostedHeroItem } from "@/lib/anime-hosted-hero";
import { fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import { useSettings } from "@/lib/settings";
import { isAdultAnime } from "@/lib/addons-store/adult-filter";
import { isAnimeCwItem, isCwMember, library, type LibraryItem } from "@/lib/stremio";
import { clearLocalCw } from "@/lib/local-cw";
import {
  dismissManualWatched,
  manualWatchedLibraryItems,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import {
  loadSimklWatchedMap,
  loadSimklStatusMap,
  type WatchlistStatus,
} from "@/lib/simkl/list-status";
import { loadAnilistWatchedMap } from "@/lib/anilist/watched-map";
import { useSimkl } from "@/lib/simkl/provider";
import { useScrollMemory, useView } from "@/lib/view";

function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

export function AnimeView({ active = true }: { active?: boolean }) {
  const t = useT();
  const { settings, update } = useSettings();

  const animeSpecs = useMemo<CatalogRowSpec[]>(
    () =>
      SPECS.map((s) => ({
        key: s.key,
        title: s.title,
        fetcher: s.fetcher,
        minVisible: ROW_MIN_VISIBLE,
      })),
    [],
  );

  const { rowsByKey: catalogRowsByKey, loadMore } = useCatalogPage({
    pageId: "anime",
    scope: "jikan",
    specs: animeSpecs,
    enabled: active,
    maxPerRow: 80,
  });

  // Keep anime-compatible RowState shape (ready flag for skeletons).
  const rowsByKey = useMemo(() => {
    const map: Record<string, RowState> = {};
    for (const s of SPECS) {
      const r = catalogRowsByKey[s.key];
      map[s.key] = r
        ? {
            metas: r.metas,
            page: r.page,
            hasMore: r.hasMore && r.page < ROW_MAX_PAGES,
            ready: r.ready,
          }
        : EMPTY_ROW;
    }
    return map;
  }, [catalogRowsByKey]);

  const filterSig = `${settings.animeExcludeOrigins.join(",")}|${settings.animeHideWatchedPicks}`;
  const [heroSeed, setHeroSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [hero, setHero] = useState<HeroBuilt>(
    () => readCachedHero(filterSig) ?? { metas: [], trending: {} },
  );
  const heroBuildRef = useRef(0);
  const heroResolvedRef = useRef(false);
  const heroBuildingRef = useRef(false);
  const filtersInitRef = useRef(true);
  const [anilistTrending, setAnilistTrending] = useState<Meta[]>([]);
  const [hostedHero, setHostedHero] = useState<HostedHeroItem[] | null>(() => peekHostedHero());
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchHostedHero()
      .then((h) => {
        if (!cancelled && h) setHostedHero(h);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchAnilistTrendingAnime(30)
      .then((m) => {
        if (!cancelled) setAnilistTrending(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);
  useEffect(() => {
    if (filtersInitRef.current) {
      filtersInitRef.current = false;
      return;
    }
    heroResolvedRef.current = false;
    setHeroSeed(Math.floor(Math.random() * 0x7fffffff));
    setHero({ metas: [], trending: {} });
  }, [filterSig]);
  useEffect(() => {
    const filterOpts: AnimeFilterOpts = {
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
    };
    if (hero.metas.length === 0 && hostedHero && hostedHero.length >= 3) {
      const hosted = buildHostedHero(hostedHero, heroSeed, filterOpts);
      if (hosted.metas.length >= 3) {
        heroResolvedRef.current = true;
        heroBuildRef.current += 1;
        setHero(hosted);
        cacheHero(hosted, filterSig);
        return;
      }
    }
    if (heroResolvedRef.current) return;
    if (hero.metas.length > 0 && isHeroCacheFresh(filterSig)) {
      heroResolvedRef.current = true;
      return;
    }
    const readyCount = SPECS.filter((s) => rowsByKey[s.key]?.ready).length;
    if (readyCount < 2 && anilistTrending.length === 0) return;
    if (heroBuildingRef.current) return;
    const built = buildHeroSelection(rowsByKey, heroSeed, filterOpts, anilistTrending);
    if (built.metas.length < 3) return;
    heroBuildingRef.current = true;
    const buildId = ++heroBuildRef.current;
    void resolveHeroSlides(settings.tmdbKey, built, filterOpts, (resolved) => {
      if (heroBuildRef.current === buildId && resolved.metas.length >= 1) {
        heroResolvedRef.current = true;
        setHero(resolved);
        cacheHero(resolved, filterSig);
      }
    })
      .catch(() => {})
      .finally(() => {
        heroBuildingRef.current = false;
      });
  }, [
    rowsByKey,
    heroSeed,
    hero.metas.length,
    anilistTrending,
    settings.tmdbKey,
    filterSig,
    hostedHero,
  ]);
  const heroMetas = hero.metas;
  const heroTrending = hero.trending;

  const { openGrid } = useView();
  const favoriteGenres = settings.animeFavoriteGenres;
  const anilistHidden = settings.animeAnilistRowsHidden;
  const malRowsHidden = settings.animeMalRowsHidden;
  const [showPicker, setShowPicker] = useState(false);

  const { authKey } = useAuth();
  const cwVersion = useCwDismissVersion();
  const { isConnected: simklConnected } = useSimkl();
  const [libItems, setLibItems] = useState<LibraryItem[]>([]);
  const [simklCw, setSimklCw] = useState<LibraryItem[]>([]);
  const [simklWatchedMap, setSimklWatchedMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [simklStatusMap, setSimklStatusMap] = useState<Map<string, WatchlistStatus>>(
    () => new Map(),
  );
  const [anilistWatchedMap, setAnilistWatchedMap] = useState<Map<string, Set<string>>>(
    () => new Map(),
  );
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  useEffect(() => {
    if (!authKey) {
      setLibItems([]);
      setAddonRows([]);
      return;
    }
    const load = () => {
      library(authKey)
        .then(setLibItems)
        .catch(() => setLibItems([]));
    };
    load();
    loadAddonRows(authKey)
      .then((rows) => setAddonRows(rows.filter(isAnimeRow)))
      .catch(() => setAddonRows([]));
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [authKey]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklCw([]);
      return;
    }
    let cancelled = false;
    fetchSimklPlaybackItems()
      .then((cw) => {
        if (!cancelled) setSimklCw(cw.filter(isAnimeCwItem));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  const animeDetectVer = useDetectedAnimeVersion();
  const [cwRootVersion, setCwRootVersion] = useState(0);
  const continueWatching = useMemo(() => {
    const seen = new Set<string>();
    const seenRoot = new Set<string>();
    return [...libItems, ...simklCw]
      .filter((i) => {
        if (!isCwMember(i)) return false;
        if (!isAnimeCwItem(i)) return false;
        if (isCwDismissed(i)) return false;
        if (seen.has(i._id)) return false;
        seen.add(i._id);
        return true;
      })
      .sort(
        (a, b) =>
          Date.parse(b.state?.lastWatched ?? b._mtime) -
          Date.parse(a.state?.lastWatched ?? a._mtime),
      )
      .filter((i) => {
        const root = franchiseRootSync(i._id);
        if (!root) return true;
        if (seenRoot.has(root)) return false;
        seenRoot.add(root);
        return true;
      })
      .slice(0, 20);
  }, [libItems, simklCw, cwVersion, animeDetectVer, cwRootVersion]);

  useEffect(() => {
    const ids = [...libItems, ...simklCw]
      .filter((i) => isCwMember(i) && isAnimeCwItem(i))
      .map((i) => i._id);
    if (ids.length === 0) return;
    if (ids.every((id) => franchiseRootSync(id))) return;
    let cancelled = false;
    void Promise.all(ids.map((id) => franchiseRoot(id).catch(() => id))).then(() => {
      if (!cancelled) setCwRootVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [libItems, simklCw]);

  useEffect(() => {
    publishResumeStates(continueWatching);
  }, [continueWatching]);

  const manualWatchedVer = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const resurfaceLibrary = useMemo(() => {
    const manual = manualWatchedLibraryItems().filter(isAnimeCwItem);
    if (manual.length === 0) return libItems;
    const cwMemberIds = new Set(libItems.filter(isCwMember).map((i) => i._id));
    const usable = manual.filter((i) => !cwMemberIds.has(i._id));
    if (usable.length === 0) return libItems;
    const overrideIds = new Set(usable.map((i) => i._id));
    return [...libItems.filter((i) => !overrideIds.has(i._id)), ...usable];
  }, [libItems, manualWatchedVer]);
  useEffect(() => {
    if (!simklConnected) {
      setSimklWatchedMap(new Map());
      setSimklStatusMap(new Map());
      return;
    }
    let cancelled = false;
    loadSimklWatchedMap()
      .then((m) => {
        if (!cancelled) setSimklWatchedMap(m);
      })
      .catch(() => {});
    loadSimklStatusMap()
      .then((m) => {
        if (!cancelled) setSimklStatusMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);
  useEffect(() => {
    let cancelled = false;
    const ids = continueWatching
      .filter((i) => /^(kitsu|mal|anilist):/.test(i._id))
      .map((i) => i._id);
    loadAnilistWatchedMap(ids)
      .then((m) => {
        if (!cancelled) setAnilistWatchedMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [continueWatching]);
  const emptyTrakt = useMemo(() => new Set<string>(), []);
  const cwItems = useCwAdvance(
    continueWatching,
    settings.tmdbKey,
    settings.cwAdvanceNext,
    resurfaceLibrary,
    "only",
    manualWatchedVer,
    emptyTrakt,
    simklWatchedMap,
    anilistWatchedMap,
    simklStatusMap,
    animeDetectVer,
  );

  useEffect(() => {
    void detectAnimeForCw(libItems);
  }, [libItems]);

  const watchHistoryRecs = useWatchHistoryRecommendations(continueWatching);

  const topPicksRaw = useAnimeTopPicks({
    libItems,
    continueWatching,
    heroMetas,
    watchHistoryRecs,
    favoriteGenres,
  });
  const [picksEnriched, setPicksEnriched] = useState<Meta[]>([]);
  useEffect(() => {
    let cancelled = false;
    void enrichAnimeCountry(topPicksRaw).then((e) => {
      if (!cancelled) setPicksEnriched(e);
    });
    return () => {
      cancelled = true;
    };
  }, [topPicksRaw]);
  const topPicks = useMemo(() => {
    const opts: AnimeFilterOpts = {
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
    };
    const base = picksEnriched.length > 0 ? picksEnriched : topPicksRaw;
    const filtered = base.filter((m) => !animeFiltered(m, opts));
    if (filtered.length > 0) return filtered;
    if (hostedHero && hostedHero.length > 0) {
      const heroIds = new Set(heroMetas.map((m) => m.id));
      return hostedHero.filter((m) => !heroIds.has(m.id) && !animeFiltered(m, opts)).slice(0, 20);
    }
    return filtered;
  }, [
    picksEnriched,
    topPicksRaw,
    settings.animeExcludeOrigins,
    settings.animeHideWatchedPicks,
    hostedHero,
    heroMetas,
  ]);

  const awardWinnerEntries = useCrunchyrollAwardMetas();
  const awardWinnersRaw = useMemo(() => {
    const winByKey = uniqueWinnerFranchisesAcrossSources();
    const resolvedByFk = new Map<string, Meta>();
    for (const e of awardWinnerEntries) resolvedByFk.set(awardFranchiseKey(e.meta.name), e.meta);
    const seen = new Set<string>();
    const out: Array<{ meta: Meta; year: number; lookupName: string }> = [];

    for (const spec of SPECS) {
      const r = rowsByKey[spec.key];
      if (!r?.ready) continue;
      for (const m of r.metas) {
        const fk = awardFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        const win = winByKey.get(fk);
        if (!win) continue;
        seen.add(fk);
        const rootMeta = resolvedByFk.get(fk) ?? m;
        out.push({ meta: cleanMeta(rootMeta), year: win.year, lookupName: win.title });
      }
    }

    for (const e of awardWinnerEntries) {
      const fk = awardFranchiseKey(e.meta.name);
      if (seen.has(fk)) continue;
      seen.add(fk);
      out.push({ meta: cleanMeta(e.meta), year: e.win.year, lookupName: e.win.title });
    }

    out.sort((a, b) => b.year - a.year);
    return out;
  }, [rowsByKey, awardWinnerEntries]);
  const awardWinnerMetas = useMemo<Meta[]>(
    () => awardWinnersRaw.map((x) => x.meta),
    [awardWinnersRaw],
  );
  const awardLookupByMetaId = useMemo(() => {
    const out: Record<string, string> = {};
    for (const x of awardWinnersRaw) out[x.meta.id] = x.lookupName;
    return out;
  }, [awardWinnersRaw]);

  const filteredRowsByKey = useMemo<Record<string, RowState>>(() => {
    const heroSeen = new Set<string>();
    for (const m of heroMetas) heroSeen.add(animeFranchiseKey(m.name));
    for (const m of topPicks) heroSeen.add(animeFranchiseKey(m.name));
    const pools: Record<RowPool, Set<string>> = {
      general: new Set(heroSeen),
      era: new Set(heroSeen),
      genre: new Set(heroSeen),
    };
    const out: Record<string, RowState> = {};
    for (const spec of SPECS) {
      const row = rowsByKey[spec.key];
      if (!row) {
        out[spec.key] = EMPTY_ROW;
        continue;
      }
      if (spec.key === "upcoming" || !row.ready) {
        out[spec.key] = row;
        continue;
      }
      const seen = pools[spec.pool ?? "general"];
      const filtered: Meta[] = [];
      for (const m of row.metas) {
        const fk = animeFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        seen.add(fk);
        filtered.push(cleanMeta(m));
      }
      out[spec.key] = { ...row, metas: filtered };
    }
    return out;
  }, [rowsByKey, heroMetas, topPicks]);

  useEffect(() => {
    for (const spec of SPECS) {
      const raw = rowsByKey[spec.key];
      if (!raw?.ready || !raw.hasMore || raw.page >= ROW_MAX_PAGES) continue;
      const shown = filteredRowsByKey[spec.key];
      if (!shown || shown.metas.length >= ROW_MIN_VISIBLE) continue;
      loadMore(spec.key);
    }
  }, [rowsByKey, filteredRowsByKey, loadMore]);

  const dedupedAddonRows = useMemo(() => {
    const seen = new Set<string>();
    for (const s of SPECS) seen.add(normalizeName(s.title, "anime"));
    const out: AddonRow[] = [];
    for (const r of addonRows) {
      const key = normalizeName(r.name, "anime");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        settings.hideContent.adult ? { ...r, metas: r.metas.filter((m) => !isAdultAnime(m)) } : r,
      );
    }
    return out;
  }, [addonRows, settings.hideContent.adult]);

  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("anime", scrollRef, active);

  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      const fire = () =>
        window.dispatchEvent(
          new CustomEvent("harbor:reset-row-scrolls", { detail: { prefix: "anime:" } }),
        );
      fire();
      const r1 = requestAnimationFrame(fire);
      const r2 = window.setTimeout(fire, 80);
      prevActiveRef.current = active;
      return () => {
        cancelAnimationFrame(r1);
        window.clearTimeout(r2);
      };
    }
    prevActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ anchor: string }>).detail;
      const anchor = detail?.anchor;
      if (!anchor) return;
      const root = scrollRef.current;
      if (!root) return;
      const tryScroll = () => {
        const el = root.querySelector<HTMLElement>(`[data-scroll-anchor="${anchor}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return true;
        }
        return false;
      };
      if (tryScroll()) return;
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        if (tryScroll() || attempts > 20) window.clearInterval(id);
      }, 150);
    };
    window.addEventListener("harbor:anime-focus-row", handler as EventListener);
    return () => window.removeEventListener("harbor:anime-focus-row", handler as EventListener);
  }, []);

  return (
    <main ref={scrollCb} className="flex-1 overflow-y-auto overflow-x-hidden px-12 pt-28 pb-14">
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="flex flex-col gap-12">
          {heroMetas.length > 0 ? (
            <div data-scroll-anchor="hero" className="relative harbor-anime-hero">
              <AnimeHero slides={heroMetas} topPicks={topPicks} trendingByMetaId={heroTrending} />
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                title={t("Tune anime")}
                aria-label={t("Tune anime")}
                className="group absolute end-[-3rem] top-[34%] z-10 flex flex-col items-center gap-2.5 rounded-s-xl border border-e-0 border-edge-soft/40 bg-canvas/55 py-4 pe-2 ps-2 text-ink-subtle opacity-45 backdrop-blur-md transition-all duration-300 hover:bg-canvas/85 hover:text-ink hover:opacity-100 hover:ps-3"
              >
                <SlidersHorizontal
                  size={15}
                  strokeWidth={2}
                  className="text-ink-muted transition-colors group-hover:text-accent"
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] [writing-mode:vertical-rl]">
                  {t("Tune")}
                </span>
                {favoriteGenres.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[9px] font-bold leading-none text-accent">
                    {favoriteGenres.length}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="harbor-anime-hero">
              <AnimeHeroSkeleton />
            </div>
          )}
          {cwItems.length > 0 && (
            <Row title={t("Continue Watching")} min={260} shape="landscape" scrollKey="anime:cw">
              {cwItems.map((item) => (
                <ContinueCard
                  key={item._id}
                  item={item}
                  onDismiss={(it) =>
                    it.manualWatched
                      ? dismissManualWatched(it._id)
                      : it.local
                        ? clearLocalCw(it._id)
                        : dismissCw(it, authKey)
                  }
                />
              ))}
            </Row>
          )}
          {!malRowsHidden.includes("yourMalLists") && <MalRows />}
          {!anilistHidden.includes("yourLists") && <AnilistRows />}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <AnilistRowControls />
            <MalRowControls />
          </div>
          {!anilistHidden.includes("trending") && <AnilistTrendingRow />}
          {!anilistHidden.includes("top100") && <AnilistTopRow />}
          {awardWinnerMetas.length > 0 && (
            <div data-scroll-anchor="row:anime-awards">
              <Row title={t("Award Winning Anime")} scrollKey="anime:awards">
                {awardWinnerMetas.map((m) => (
                  <PickCard key={m.id} meta={m} awardLookupName={awardLookupByMetaId[m.id]} />
                ))}
              </Row>
            </div>
          )}
          {SPECS.map((spec) => {
            if (spec.key === TOP_PICKS_KEY) return null;
            const r = filteredRowsByKey[spec.key] ?? EMPTY_ROW;
            if (r.ready && r.metas.length === 0) return null;
            const viewAll = () =>
              openGrid({
                title: t(spec.title),
                fetcher: (p) => spec.fetcher(p).then((ms) => ms.map(cleanMeta)),
                initial: r.metas,
              });
            return (
              <div key={spec.key} data-scroll-anchor={`row:${spec.key}`}>
                {!r.ready ? (
                  <RowSkeleton
                    title={
                      spec.rank
                        ? t("Top 10 {name}", { name: t(spec.title).replace(/^Top\s*/i, "") })
                        : t(spec.title)
                    }
                  />
                ) : spec.rank && r.metas.length >= 10 ? (
                  <Row
                    title={t("Top 10 {name}", { name: t(spec.title).replace(/^Top\s*/i, "") })}
                    min={180}
                    shape="rank"
                    scrollKey={`anime:${spec.key}`}
                    onViewAll={viewAll}
                  >
                    {r.metas.slice(0, 10).map((m, i) => (
                      <AnimeRankCard key={m.id} meta={m} rank={i + 1} />
                    ))}
                  </Row>
                ) : (
                  <Row
                    title={t(spec.title)}
                    scrollKey={`anime:${spec.key}`}
                    onEndReached={r.hasMore ? () => loadMore(spec.key) : undefined}
                    onViewAll={viewAll}
                  >
                    {r.metas.map((m, i) => (
                      <PickCard key={`${m.id}-${i}`} meta={m} />
                    ))}
                  </Row>
                )}
              </div>
            );
          })}
          {dedupedAddonRows.map((row) => (
            <div key={row.key} data-scroll-anchor={`row:${row.key}`}>
              <Row
                title={row.name}
                scrollKey={`anime:addon:${row.key}`}
                onViewAll={
                  row.more && row.metas.length > 0
                    ? () =>
                        openGrid({
                          title: row.name,
                          fetcher: createAddonCatalogFetcher(row.more!, {
                            initialPageSize: row.metas.length,
                            mapMeta: cleanMeta,
                          }),
                          initial: row.metas.map(cleanMeta),
                        })
                    : undefined
                }
              >
                {row.metas.map((m, i) => (
                  <PickCard key={`${m.id}-${i}`} meta={cleanMeta(m)} />
                ))}
              </Row>
            </div>
          ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
      {showPicker && (
        <AnimeGenrePicker
          initial={favoriteGenres}
          onSave={(g) => update({ animeFavoriteGenres: g, animePicksDismissedAt: Date.now() })}
          onClose={() => {
            setShowPicker(false);
            update({ animePicksDismissedAt: Date.now() });
          }}
        />
      )}
    </main>
  );
}
