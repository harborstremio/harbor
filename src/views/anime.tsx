import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimeGenrePicker } from "@/components/anime-genre-picker";
import { preloadAnimeGenreArt } from "@/lib/anime-genre-art-map";
import { AnimeHero, AnimeHeroSkeleton } from "@/components/anime-hero";
import { BackToTop } from "@/components/back-to-top";
import { ContinueCard } from "@/components/continue-card";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { PickCard } from "@/components/pick-card";
import { Row, ScrollRootContext } from "@/components/row";
import { AnimeRankCard } from "@/components/top-rank-card";
import { useAuth } from "@/lib/auth";
import { anyProfileSharesStremioWith, useProfiles } from "@/lib/profiles";
import { createAddonCatalogFetcher, isCollectionCatalog, loadAddonRows, normalizeName, type AddonRow } from "@/lib/addons";
import type { Meta } from "@/lib/cinemeta";
import { awardFranchiseKey, uniqueWinnerFranchisesAcrossSources } from "@/lib/anime-awards";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { PencilOutlineIcon } from "@/components/icons/pencil-outline";
import { useT } from "@/lib/i18n";
import { useAnimeTopPicks } from "@/lib/use-anime-top-picks";
import { useCrunchyrollAwardMetas } from "@/lib/use-crunchyroll-award-metas";
import { useWatchHistoryRecommendations } from "@/lib/use-watch-history-recs";
import { AnilistRows } from "./anime/anilist-rows";
import { MalRows } from "./anime/mal-rows";
import { useCwAdvance } from "./home/hooks/use-cw-advance";
import { detectAnimeForCw, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { RowControls } from "./home/row-controls";
import {
  applyAnimeRowCustomization,
  animeEffectiveOrder,
  animeHasCustomization,
  animeMoveRow,
  animeRenameRow,
  animeToggleHidden,
} from "@/lib/anime-customization";
import { AnilistTopRow, AnilistTrendingRow } from "./anime/anilist-top-row";
import {
  EMPTY_ROW,
  ROW_MAX_PAGES,
  ROW_MIN_VISIBLE,
  RowSkeleton,
  SPECS,
  TOP_PICKS_KEY,
  isAnimeRow,
  type RowPool,
  type RowState,
} from "./anime/anime-rows";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";
import { franchiseRoot, franchiseRootSync } from "@/lib/providers/anime-franchise-root";
import { animeFiltered, enrichAnimeCountry, type AnimeFilterOpts } from "@/lib/anime-filter";
import {
  buildHeroSelection,
  buildHostedHero,
  cacheHero,
  heroSourceLabel,
  isHeroCacheFresh,
  readCachedHero,
  resolveHeroSlides,
  upgradeHeroArtFromStatic,
  type HeroBuilt,
} from "./anime/hero-build";
import { fetchHostedHero, peekHostedHero, type HostedHeroItem } from "@/lib/anime-hosted-hero";
import { fetchMalHeroList, type MalHeroItem } from "@/lib/mal-hero";
import {
  ensureStaticHeroArt,
  peekStaticHeroArt,
  staticHeroPool,
} from "@/lib/providers/anime-hero-art-static";
import { useAnnouncement } from "@/lib/announcements";
import { AnnouncementHero } from "@/components/announcement-hero";
import { fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import { useSettings } from "@/lib/settings";
import { useCollectionRowsForPage } from "@/lib/page-collection-rows";
import { useContentDrag } from "@/lib/window-drag";
import { isAdultAnime } from "@/lib/addons-store/adult-filter";
import { absorbCloudAnimeCw } from "@/lib/anime-cw-absorb";
import { ANIME_CLOUD_ID, isAnimeCwItem, isCwMember, library, type LibraryItem } from "@/lib/stremio";
import { clearLocalCw, listLocalCw, localCwEntry, localCwVersion, subscribeLocalCw } from "@/lib/local-cw";
import { dismissManualWatched, manualWatchedLibraryItems, manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import { loadSimklWatchedMap, loadSimklStatusMap, simklWatchedForId, statusForId, type WatchlistStatus } from "@/lib/simkl/list-status";
import { loadAnilistWatchedMap } from "@/lib/anilist/watched-map";
import { useSimkl } from "@/lib/simkl/provider";
import { useScrollMemory, useView } from "@/lib/view";

export { isAnimeRow } from "./anime/anime-rows";

function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

export function AnimeView({ active = true }: { active?: boolean }) {
  const t = useT();
  const { settings, update } = useSettings();
  const { activeProfile, profiles } = useProfiles();
  const hideSharedCw =
    settings.cwPerProfile && anyProfileSharesStremioWith(activeProfile, profiles);
  const [editMode, setEditMode] = useState(false);
  const contentDrag = useContentDrag();
  const [rowsByKey, setRowsByKey] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const s of SPECS) init[s.key] = EMPTY_ROW;
    return init;
  });
  const rowsRef = useRef(rowsByKey);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rowsByKey;
  }, [rowsByKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const BATCH = 6;
      const GAP_MS = 350;
      for (let i = 0; i < SPECS.length; i += BATCH) {
        if (cancelled) return;
        const batch = SPECS.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (s) => {
            try {
              const metas = await s.fetcher(1);
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas, page: 1, hasMore: metas.length >= ROW_MIN_VISIBLE, ready: true },
              }));
            } catch {
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas: [], page: 1, hasMore: false, ready: true },
              }));
            }
          }),
        );
        if (i + BATCH < SPECS.length) {
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback((key: string) => {
    if (loadingRef.current.has(key)) return;
    const spec = SPECS.find((s) => s.key === key);
    const row = rowsRef.current[key];
    if (!spec || !row || !row.hasMore || row.metas.length >= 80) return;
    loadingRef.current.add(key);
    const next = row.page + 1;
    spec
      .fetcher(next)
      .then((more) => {
        setRowsByKey((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const ids = new Set(cur.metas.map((m) => m.id));
          const fresh = more.filter((m) => !ids.has(m.id));
          return {
            ...prev,
            [key]: {
              ...cur,
              metas: [...cur.metas, ...fresh],
              page: next,
              hasMore: more.length >= ROW_MIN_VISIBLE && cur.metas.length + fresh.length < 80,
            },
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(key);
      });
  }, []);

  const filterSig = `${settings.animeExcludeOrigins.join(",")}|${settings.animeHideWatchedPicks}`;
  const [heroSeed, setHeroSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const [hero, setHero] = useState<HeroBuilt>(() => readCachedHero(filterSig) ?? { metas: [], trending: {} });
  const [malExtra, setMalExtra] = useState<MalHeroItem[]>([]);
  const heroBuildRef = useRef(0);
  const heroResolvedRef = useRef(false);
  const heroBuildingRef = useRef(false);
  const heroActivateRef = useRef(false);
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
  const buildHostedSelection = useCallback(
    (seed: number): boolean => {
      if (!hostedHero || hostedHero.length < 3) return false;
      const filterOpts: AnimeFilterOpts = {
        excludeOrigins: settings.animeExcludeOrigins,
        hideWatched: settings.animeHideWatchedPicks,
      };
      const hosted = buildHostedHero(hostedHero, seed, filterOpts);
      if (hosted.metas.length < 3) return false;
      heroResolvedRef.current = true;
      const buildId = ++heroBuildRef.current;
      setHero(hosted);
      cacheHero(hosted, filterSig);
      void upgradeHeroArtFromStatic(hosted).then((up) => {
        if (heroBuildRef.current === buildId) {
          setHero(up);
          cacheHero(up, filterSig);
        }
      });
      return true;
    },
    [hostedHero, settings.animeExcludeOrigins, settings.animeHideWatchedPicks, filterSig],
  );
  useEffect(() => {
    if (hero.metas.length === 0 && buildHostedSelection(heroSeed)) return;
    if (heroResolvedRef.current) return;
    if (hero.metas.length > 0 && isHeroCacheFresh(filterSig)) {
      heroResolvedRef.current = true;
      return;
    }
    if (buildHostedSelection(heroSeed)) return;
    const readyCount = SPECS.filter((s) => rowsByKey[s.key]?.ready).length;
    if (readyCount < 2 && anilistTrending.length === 0) return;
    if (heroBuildingRef.current) return;
    const filterOpts: AnimeFilterOpts = {
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
    };
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
    buildHostedSelection,
  ]);
  const heroMetas = hero.metas;
  const heroTrending = hero.trending;

  const { openGrid } = useView();
  const favoriteGenres = settings.animeFavoriteGenres;
  const [showPicker, setShowPicker] = useState(false);

  const { authKey } = useAuth();
  const cwVersion = useCwDismissVersion();
  const { isConnected: simklConnected } = useSimkl();
  const [libItems, setLibItems] = useState<LibraryItem[]>([]);
  const [simklCw, setSimklCw] = useState<LibraryItem[]>([]);
  const [simklWatchedMap, setSimklWatchedMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [simklStatusMap, setSimklStatusMap] = useState<Map<string, WatchlistStatus>>(() => new Map());
  const [anilistWatchedMap, setAnilistWatchedMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  useEffect(() => {
    if (!authKey) {
      setLibItems([]);
      setAddonRows([]);
      return;
    }
    const load = () => {
      library(authKey)
        .then((li) => {
          setLibItems(li);
          if (!hideSharedCw) absorbCloudAnimeCw(li);
        })
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
  }, [authKey, hideSharedCw]);

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
  const localCwVer = useSyncExternalStore(subscribeLocalCw, localCwVersion);
  const localAnimeCw = useMemo<LibraryItem[]>(() => {
    void localCwVer;
    return listLocalCw()
      .filter((e) => ANIME_CLOUD_ID.test(e.id))
      .map((e) => ({
        _id: e.id,
        type: e.type,
        name: e.name,
        poster: e.poster,
        background: e.background,
        state: {
          timeOffset: e.positionMs,
          duration: e.durationMs,
          season: e.season,
          episode: e.episode,
          video_id: e.videoId,
          flaggedWatched: e.durationMs > 0 && e.positionMs / e.durationMs >= 0.9 ? 1 : 0,
          lastWatched: new Date(e.t).toISOString(),
        },
        removed: false,
        temp: false,
        _ctime: new Date(e.t).toISOString(),
        _mtime: new Date(e.t).toISOString(),
        local: true,
      }));
  }, [localCwVer]);
  const continueWatching = useMemo(() => {
    const seen = new Set<string>();
    const seenRoot = new Set<string>();
    return [...localAnimeCw, ...libItems.filter((i) => !ANIME_CLOUD_ID.test(i._id)), ...simklCw]
      .filter((i) => {
        if (!isCwMember(i)) return false;
        if (!i.local && !isAnimeCwItem(i)) return false;
        if (isCwDismissed(i)) return false;
        if (hideSharedCw && localCwEntry(i._id) === null && !i.local) return false;
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
  }, [localAnimeCw, libItems, simklCw, cwVersion, animeDetectVer, cwRootVersion, hideSharedCw, localCwVer]);

  useEffect(() => {
    const ids = [...localAnimeCw, ...libItems.filter((i) => !ANIME_CLOUD_ID.test(i._id)), ...simklCw]
      .filter((i) => isCwMember(i) && (i.local || isAnimeCwItem(i)))
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
  }, [localAnimeCw, libItems, simklCw]);

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
  const isAnimeWatched = useCallback(
    (id: string): boolean =>
      statusForId(simklStatusMap, id) === "completed" ||
      simklWatchedForId(simklWatchedMap, id).size > 0 ||
      (anilistWatchedMap.get(id)?.size ?? 0) > 0,
    [simklStatusMap, simklWatchedMap, anilistWatchedMap],
  );
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
    settings.episodeHiding,
    settings.animeCwEnd,
  );

  const cwSig = cwItems.map((i) => `${i._id}:${i.state?.season ?? ""}:${i.state?.episode ?? ""}`).join("|");
  const [cwReady, setCwReady] = useState(false);
  useEffect(() => {
    if (cwReady) return;
    const settle = window.setTimeout(() => setCwReady(true), 150);
    return () => window.clearTimeout(settle);
  }, [cwSig, cwReady]);
  useEffect(() => {
    const cap = window.setTimeout(() => setCwReady(true), 650);
    return () => window.clearTimeout(cap);
  }, []);

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
  useEffect(() => {
    const isId = (id: string) => /^(kitsu|mal|anilist):/.test(id);
    const ids = new Set<string>();
    for (const i of continueWatching) if (isId(i._id)) ids.add(i._id);
    for (const m of topPicksRaw) if (isId(m.id)) ids.add(m.id);
    for (const m of heroMetas) if (isId(m.id)) ids.add(m.id);
    for (const m of anilistTrending) if (isId(m.id)) ids.add(m.id);
    for (const m of hostedHero ?? []) if (isId(m.id)) ids.add(m.id);
    if (ids.size === 0) return;
    let cancelled = false;
    loadAnilistWatchedMap([...ids])
      .then((m) => {
        if (!cancelled) setAnilistWatchedMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [continueWatching, topPicksRaw, heroMetas, anilistTrending, hostedHero]);
  const topPicks = useMemo(() => {
    const opts: AnimeFilterOpts = {
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
      isWatched: isAnimeWatched,
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
    isAnimeWatched,
  ]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(preloadAnimeGenreArt, 1500);
    return () => window.clearTimeout(timer);
  }, [active]);
  const [staticPoolReady, setStaticPoolReady] = useState(0);
  useEffect(() => {
    if (!active) return;
    void ensureStaticHeroArt().then(() => setStaticPoolReady((n) => n + 1));
  }, [active]);
  useEffect(() => {
    if (!active || malExtra.length > 0) return;
    let cancelled = false;
    void fetchMalHeroList().then((items) => {
      if (!cancelled && items.length > 0) setMalExtra(items);
    });
    return () => {
      cancelled = true;
    };
  }, [active, malExtra.length]);
  const heroSlides = useMemo(() => {
    const front =
      settings.animeHideWatchedPicks && heroMetas.some((m) => !isAnimeWatched(m.id))
        ? heroMetas.filter((m) => !isAnimeWatched(m.id))
        : heroMetas;
    if (front.length === 0) return front;
    const opts: AnimeFilterOpts = {
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
      isWatched: isAnimeWatched,
    };
    const seenBg = new Set(front.map((m) => m.background));
    const seenFr = new Set(front.filter((m) => m.name).map((m) => animeFranchiseKey(m.name)));
    const consider = (m: Meta): boolean => {
      if (seenBg.has(m.background) || animeFiltered(m, opts)) return false;
      const fr = m.name ? animeFranchiseKey(m.name) : "";
      if (fr && seenFr.has(fr)) return false;
      seenBg.add(m.background);
      if (fr) seenFr.add(fr);
      return true;
    };
    const malPool: Meta[] = [];
    for (const m of peekHostedHero() ?? [])
      if ((m as { source?: string }).source === "MyAnimeList" && consider(m)) malPool.push(m);
    for (const it of malExtra) {
      const art = peekStaticHeroArt(it.id);
      if (!art?.bg) continue;
      const m: Meta & { source?: string } = {
        id: it.id,
        type: it.format === "MOVIE" ? "movie" : "series",
        name: it.name,
        description: it.description,
        background: art.bg,
        logo: art.logo ?? undefined,
        poster: it.poster,
        releaseInfo: it.year,
        imdbRating: it.rating,
        animeFormat: it.format,
        source: "MyAnimeList",
      };
      if (consider(m)) malPool.push(m);
    }
    const bulk: Meta[] = [];
    for (const m of staticHeroPool()) if (consider(m)) bulk.push(m);
    if (malPool.length === 0) return [...front, ...bulk];
    const step = Math.max(3, Math.floor(bulk.length / malPool.length));
    const mixed: Meta[] = [];
    let mi = 0;
    for (let i = 0; i < bulk.length; i += 1) {
      mixed.push(bulk[i]);
      if (mi < malPool.length && (i + 1) % step === 0) mixed.push(malPool[mi++]);
    }
    while (mi < malPool.length) mixed.push(malPool[mi++]);
    return [...front, ...mixed];
  }, [
    heroMetas,
    isAnimeWatched,
    settings.animeHideWatchedPicks,
    settings.animeExcludeOrigins,
    staticPoolReady,
    malExtra,
  ]);
  const heroTrendingAll = useMemo(() => {
    const m: Record<string, string> = { ...heroTrending };
    for (const s of heroSlides)
      if (!(s.id in m)) m[s.id] = heroSourceLabel((s as { source?: string }).source);
    return m;
  }, [heroTrending, heroSlides]);
  const { announcement, seen: announcementSeen, dismiss: announcementDismiss } = useAnnouncement();

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
        settings.hideContent.adult
          ? { ...r, metas: r.metas.filter((m) => !isAdultAnime(m)) }
          : r,
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
  const animeCollections = useCollectionRowsForPage("anime");

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
    if (!active) {
      heroActivateRef.current = false;
      return;
    }
    if (heroActivateRef.current) return;
    heroActivateRef.current = true;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    setHeroSeed(seed);
    buildHostedSelection(seed);
  }, [active, buildHostedSelection]);

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
    <main
      ref={scrollCb}
      className="flex-1 overflow-y-auto overflow-x-hidden px-12 pt-28 pb-14"
    >
      <ScrollRootContext.Provider value={scrollEl}>
        <div {...contentDrag} className="flex flex-col gap-12">
          {announcement ? (
            <AnnouncementHero
              announcement={announcement}
              onSeen={announcementSeen}
              onDismiss={announcementDismiss}
            />
          ) : heroMetas.length > 0 ? (
            <div data-scroll-anchor="hero" className="relative harbor-anime-hero hero-reveal">
              <AnimeHero
                slides={heroSlides}
                topPicks={topPicks}
                trendingByMetaId={heroTrendingAll}
              />
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                title={t("Tune anime")}
                aria-label={t("Tune anime")}
                style={{ top: "min(22%, 200px)" }}
                className="group absolute end-[-3rem] z-20 flex flex-col items-center gap-2.5 rounded-s-xl border border-e-0 border-edge-soft/40 bg-canvas/55 py-4 pe-2 ps-2 text-ink-subtle opacity-45 backdrop-blur-md transition-all duration-300 hover:bg-canvas/85 hover:text-ink hover:opacity-100 hover:ps-3"
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
          <div className="-mb-6 -mt-6 flex items-center justify-end gap-2">
            {editMode && animeHasCustomization(settings.animeRows) && (
              <button
                onClick={() => update({ animeRows: { order: [], hidden: [], renamed: {} } })}
                className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/80 px-2.5 text-[12px] font-medium text-ink-muted backdrop-blur-md transition-colors hover:bg-canvas hover:text-ink"
              >
                <RotateCcw size={12} strokeWidth={2.2} />
                {t("Reset")}
              </button>
            )}
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium backdrop-blur-md transition-colors ${
                editMode
                  ? "border-ink bg-ink text-canvas hover:opacity-90"
                  : "border-edge-soft/40 bg-canvas/80 text-ink-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <PencilOutlineIcon size={12} />
              {editMode ? t("Done editing") : t("Customize anime")}
            </button>
          </div>
          {(() => {
            const rd: { key: string; name: string; node: ReactNode }[] = [];
            const nameOf = (key: string, fallback: string) => settings.animeRows.renamed[key] ?? fallback;
            if (cwItems.length > 0) {
              const nm = nameOf("continueWatching", t("Continue Watching"));
              rd.push({
                key: "continueWatching",
                name: nm,
                node: cwReady ? (
                  <Row title={nm} min={260} shape="landscape">
                    {cwItems.map((item) => (
                      <ContinueCard
                        key={item._id}
                        item={item}
                        onDismiss={(it) => {
                          if (it.manualWatched) {
                            dismissManualWatched(it._id);
                            return;
                          }
                          if (it.local) clearLocalCw(it._id);
                          dismissCw(it, authKey);
                        }}
                      />
                    ))}
                  </Row>
                ) : (
                  <RowSkeleton title={nm} shape="landscape" />
                ),
              });
            }
            rd.push({ key: "yourMalLists", name: nameOf("yourMalLists", t("Your MAL Lists")), node: <MalRows /> });
            rd.push({ key: "yourAnilistLists", name: nameOf("yourAnilistLists", t("Your Lists")), node: <AnilistRows /> });
            rd.push({ key: "anilistTrending", name: nameOf("anilistTrending", t("Trending")), node: <AnilistTrendingRow /> });
            rd.push({ key: "anilistTop100", name: nameOf("anilistTop100", t("Top 100")), node: <AnilistTopRow /> });
            if (awardWinnerMetas.length > 0) {
              const nm = nameOf("awards", t("Award Winning Anime"));
              rd.push({
                key: "awards",
                name: nm,
                node: (
                  <Row title={nm} scrollKey="anime:awards">
                    {awardWinnerMetas.map((m) => (
                      <PickCard key={m.id} meta={m} awardLookupName={awardLookupByMetaId[m.id]} />
                    ))}
                  </Row>
                ),
              });
            }
            for (const spec of SPECS) {
              if (spec.key === TOP_PICKS_KEY) continue;
              const r = filteredRowsByKey[spec.key] ?? EMPTY_ROW;
              if (r.ready && r.metas.length === 0) continue;
              const specName = nameOf(spec.key, t(spec.title));
              const rankName = t("Top 10 {name}", { name: specName.replace(/^Top\s*/i, "") });
              const viewAll = () =>
                openGrid({
                  title: t(spec.title),
                  fetcher: (p) => spec.fetcher(p).then((ms) => ms.map(cleanMeta)),
                  initial: r.metas,
                });
              rd.push({
                key: spec.key,
                name: spec.rank ? rankName : specName,
                node: !r.ready ? (
                  <RowSkeleton title={spec.rank ? rankName : specName} />
                ) : spec.rank && r.metas.length >= 10 ? (
                  <Row
                    title={rankName}
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
                    title={specName}
                    scrollKey={`anime:${spec.key}`}
                    onEndReached={r.hasMore ? () => loadMore(spec.key) : undefined}
                    onViewAll={viewAll}
                  >
                    {r.metas.map((m, i) => (
                      <PickCard key={`${m.id}-${i}`} meta={m} />
                    ))}
                  </Row>
                ),
              });
            }
            for (const row of dedupedAddonRows) {
              const addonName = nameOf(`addon:${row.key}`, row.name);
              rd.push({
                key: `addon:${row.key}`,
                name: addonName,
                node: (
                  <Row
                    title={addonName}
                    scrollKey={`anime:addon:${row.key}`}
                    onViewAll={
                      row.more && row.metas.length > 0
                        ? () => {
                            const collection = isCollectionCatalog({ type: row.type, id: row.more?.id, name: row.name });
                            const origin = row.metas[0]?.addonOrigin;
                            const map =
                              collection || origin
                                ? (m: Meta) => ({
                                    ...cleanMeta(m),
                                    ...(origin ? { addonOrigin: origin } : null),
                                    ...(collection ? { isCollection: true } : null),
                                  })
                                : cleanMeta;
                            openGrid({
                              title: row.name,
                              fetcher: createAddonCatalogFetcher(row.more!, {
                                initialPageSize: row.metas.length,
                                mapMeta: map,
                              }),
                              initial: row.metas.map(map),
                            });
                          }
                        : undefined
                    }
                  >
                    {row.metas.map((m, i) => (
                      <PickCard key={`${m.id}-${i}`} meta={cleanMeta(m)} />
                    ))}
                  </Row>
                ),
              });
            }
            for (const c of animeCollections) {
              if (c.items.length === 0) continue;
              const key = `collection-${c.id}`;
              const nm = nameOf(key, c.name);
              rd.push({
                key,
                name: nm,
                node: (
                  <Row title={nm}>
                    {c.items.map((it, i) => (
                      <PickCard
                        key={`${it.id}-${i}`}
                        meta={{ id: it.id, type: it.type, name: it.name, poster: it.poster }}
                      />
                    ))}
                  </Row>
                ),
              });
            }
            const orderKeys = animeEffectiveOrder(rd, settings.animeRows);
            const shown = applyAnimeRowCustomization(rd, settings.animeRows, editMode);
            return shown.map((d) => {
              const rowHidden = settings.animeRows.hidden.includes(d.key);
              const idx = orderKeys.indexOf(d.key);
              return (
                <div key={d.key} data-scroll-anchor={`row:${d.key}`} className="empty:hidden">
                  {editMode && (
                    <RowControls
                      name={d.name}
                      hidden={rowHidden}
                      canMoveUp={idx > 0}
                      canMoveDown={idx >= 0 && idx < orderKeys.length - 1}
                      onMoveUp={() => update({ animeRows: animeMoveRow(settings.animeRows, rd, d.key, -1) })}
                      onMoveDown={() => update({ animeRows: animeMoveRow(settings.animeRows, rd, d.key, 1) })}
                      onToggleHidden={() => update({ animeRows: animeToggleHidden(settings.animeRows, d.key) })}
                      onRename={(label) => update({ animeRows: animeRenameRow(settings.animeRows, d.key, label) })}
                      onResetName={() => update({ animeRows: animeRenameRow(settings.animeRows, d.key, "") })}
                      isRenamed={d.key in settings.animeRows.renamed}
                    />
                  )}
                  {!rowHidden && d.node}
                </div>
              );
            });
          })()}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
      {showPicker && (
        <AnimeGenrePicker
          initial={favoriteGenres}
          onSave={(g) =>
            update({ animeFavoriteGenres: g, animePicksDismissedAt: Date.now() })
          }
          onClose={() => {
            setShowPicker(false);
            update({ animePicksDismissedAt: Date.now() });
          }}
        />
      )}
    </main>
  );
}


