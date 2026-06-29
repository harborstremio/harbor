import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { BackToTop } from "@/components/back-to-top";
import { HeroCarousel, type Slide } from "@/components/hero-carousel";
import { CollectionsRow } from "@/components/collections-row";
import { TmdbNudge } from "@/components/nudge";
import { Row, ScrollRootContext } from "@/components/row";
import {
  applyHomeRowCustomization,
  effectiveOrder,
  moveRow,
  renameRow,
  resetHomeRows,
  toggleHeroSource,
  toggleRowHidden,
  toggleRowNumerals,
  type HomeRowCustomization,
} from "@/lib/home-customization";
import { StreamingRail } from "@/components/streaming-rail";
import { TopRankCard } from "@/components/top-rank-card";
import {
  hasTmdbProviderAddon,
  loadAddonRows,
  userAddons,
  type AddonRow,
} from "@/lib/addons";
import { isAnimeRow } from "@/views/anime";
import { buildArabicHomeRows } from "@/lib/arabic/home-rows";
import { useAuth } from "@/lib/auth";
import { type Meta } from "@/lib/cinemeta";
import { t, useT, useUiLanguage } from "@/lib/i18n";
import { useSettings, type StreamingService } from "@/lib/settings";
import { trackEvent } from "@/lib/discover";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { readResumeEntry, saveResumeBatch } from "@/lib/resume";
import {
  dismissCw,
  isCwDismissed,
  useCwDismissVersion,
} from "@/lib/cw-dismiss";
import {
  clearLocalCw,
  listLocalCw,
  localCwVersion,
  subscribeLocalCw,
} from "@/lib/local-cw";
import { repairLibraryNames } from "@/lib/stremio-repair";
import {
  cwSortKey,
  episodeFromVideoId,
  isAnimeCwItem,
  isCwMember,
  library,
  type LibraryItem,
} from "@/lib/stremio";
import { useTrakt } from "@/lib/trakt/provider";
import { buildTraktHomeRows } from "@/lib/trakt/home-rails";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import {
  recentlyPlayed,
  subscribePlayback,
  type WatchedSet,
} from "@/lib/playback-history";
import { detectAnimeForCw, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { buildSimklHomeRows } from "@/lib/simkl/home-rails";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import { useSimkl } from "@/lib/simkl/provider";
import { useMediaFavorites, type MediaEntry } from "@/lib/media-favorites";
import { useLocalWatchlist } from "@/lib/local-watchlist";
import { useScrollMemory, useView } from "@/lib/view";
import { CustomizableRows } from "./home/customizable-rows";
import { CustomizeBar } from "./home/customize-bar";
import { CWSection } from "./home/cw-section";
import { useCwAdvance } from "./home/hooks/use-cw-advance";
import {
  buildAnimeHomeRows,
  buildCinemetaRows,
  buildTmdbRows,
  isStreamingServiceRow,
  MAX_PER_ROW,
  mergeRows,
} from "./home/home-rows";
import type { HomeRow } from "./home/home-types";
import { RowSkeleton } from "./home/row-skeleton";
import { AddSourceModal } from "@/components/add-source-modal";
import type { SourceRow } from "@/lib/custom-sources";

export function Home({ active = true }: { active?: boolean }) {
  const { authKey, user } = useAuth();
  const { settings, update } = useSettings();
  const t = useT();
  const uiLang = useUiLanguage();
  const [editMode, setEditMode] = useState(false);
  const [isAddSourceModalOpen, setAddSourceModalOpen] = useState(false);
  const [rows, setRows] = useState<HomeRow[]>([]);
  const [animeRows, setAnimeRows] = useState<HomeRow[]>([]);
  const [arabicRows, setArabicRows] = useState<HomeRow[]>([]);
  const [traktRows, setTraktRows] = useState<HomeRow[]>([]);
  const [simklRows, setSimklRows] = useState<HomeRow[]>([]);
  const [simklCw, setSimklCw] = useState<LibraryItem[]>([]);
  const [traktWatched, setTraktWatched] = useState<Set<string>>(
    () => new Set(),
  );
  const [localWatched, setLocalWatched] = useState<WatchedSet>(() =>
    recentlyPlayed(),
  );
  useEffect(
    () => subscribePlayback(() => setLocalWatched(recentlyPlayed())),
    [],
  );
  const [heroPool, setHeroPool] = useState<Meta[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const cwVersion = useCwDismissVersion();
  const [tmdbProvidedByAddon, setTmdbProvidedByAddon] = useState(false);
  const [addonsTick, setAddonsTick] = useState(0);
  const { isConnected: traktConnected } = useTrakt();
  const { isConnected: simklConnected } = useSimkl();
  const rowsRef = useRef<HomeRow[]>([]);
  const loadingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadMore = useCallback((rowKey: string) => {
    if (loadingRef.current.has(rowKey)) return;
    const row = rowsRef.current.find((r) => r.key === rowKey);
    if (!row || !row.fetcher || !row.hasMore || row.metas.length === 0) return;
    if (row.metas.length >= MAX_PER_ROW) return;
    loadingRef.current.add(rowKey);
    const next = row.page + 1;
    row
      .fetcher(next)
      .then((more) => {
        setRows((rs) =>
          rs.map((r) => {
            if (r.key !== rowKey) return r;
            const ids = new Set(r.metas.map((m) => m.id));
            const fresh = more.filter((m) => !ids.has(m.id));
            const combined = [...r.metas, ...fresh];
            const reachedCap = combined.length >= MAX_PER_ROW;
            return {
              ...r,
              metas: reachedCap ? combined.slice(0, MAX_PER_ROW) : combined,
              page: next,
              hasMore: !reachedCap && fresh.length > 0,
            };
          }),
        );
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(rowKey);
      });
  }, []);

  useEffect(() => {
    const onAddonsChanged = () => setAddonsTick((t) => t + 1);
    window.addEventListener("harbor:addons-changed", onAddonsChanged);
    return () =>
      window.removeEventListener("harbor:addons-changed", onAddonsChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isClassic = settings.homeMode === "classic";

      let built: { rows: HomeRow[]; hero: Meta[] } = { rows: [], hero: [] };
      if (!isClassic) {
        built = settings.tmdbKey
          ? await buildTmdbRows(settings).catch(() => ({
              rows: [] as HomeRow[],
              hero: [] as Meta[],
            }))
          : await buildCinemetaRows().catch(() => ({
              rows: [] as HomeRow[],
              hero: [] as Meta[],
            }));
        if (built.rows.length === 0) {
          built = await buildCinemetaRows().catch(() => ({
            rows: [] as HomeRow[],
            hero: [] as Meta[],
          }));
        }
      }
      if (cancelled) return;
      setRows(mergeRows(built.rows, []));
      setHeroPool(built.hero);

      const dedupRows = isClassic ? false : !settings.homeShowAllAddonRows;
      const addons = await loadAddonRows(authKey, { dedup: dedupRows }).catch(
        () => [] as AddonRow[],
      );
      if (cancelled) return;
      const filtered = isClassic
        ? addons
        : addons.filter(
            (a) => !isAnimeRow(a) && !isStreamingServiceRow(a.name),
          );
      setRows(mergeRows(built.rows, filtered, { dedup: dedupRows }));

      if (authKey) {
        const installed = await userAddons(authKey).catch(() => []);
        if (cancelled) return;
        setTmdbProvidedByAddon(hasTmdbProviderAddon(installed));
      }
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [
    authKey,
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.region,
    settings.homeMode,
    settings.homeShowAllAddonRows,
    addonsTick,
  ]);

  useEffect(() => {
    if (settings.hideContent.anime || settings.homeMode === "classic") {
      setAnimeRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const built = await buildAnimeHomeRows();
      if (cancelled) return;
      setAnimeRows(built);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings.hideContent.anime, settings.homeMode]);

  useEffect(() => {
    if (
      uiLang !== "ar" ||
      settings.homeMode === "classic" ||
      !settings.tmdbKey
    ) {
      setArabicRows([]);
      return;
    }
    let cancelled = false;
    buildArabicHomeRows(settings.tmdbKey)
      .then((rs) => {
        if (!cancelled) setArabicRows(rs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [uiLang, settings.homeMode, settings.tmdbKey, settings.tmdbLanguage]);

  useEffect(() => {
    if (!traktConnected) {
      setTraktRows([]);
      setTraktWatched(new Set());
      return;
    }
    let cancelled = false;
    buildTraktHomeRows(settings.tmdbKey)
      .then((rs) => {
        if (!cancelled) setTraktRows(rs);
      })
      .catch(() => {});
    fetchWatchedKeySet()
      .then((set) => {
        if (!cancelled) setTraktWatched(set);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [traktConnected, settings.tmdbKey]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklRows([]);
      return;
    }
    let cancelled = false;
    buildSimklHomeRows(settings.tmdbKey)
      .then((rs) => {
        if (!cancelled) setSimklRows(rs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected, settings.tmdbKey]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklCw([]);
      return;
    }
    let cancelled = false;
    fetchSimklPlaybackItems()
      .then((cw) => {
        if (!cancelled) setSimklCw(cw);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  const trackedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!authKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      library(authKey)
        .then((libItems) => {
          if (cancelled) return;
          setItems(libItems);
          const importKey = `harbor.discover.libImported.${user?._id ?? "anon"}`;
          let importedSince = 0;
          try {
            importedSince = Number(localStorage.getItem(importKey) ?? 0) || 0;
          } catch {}
          const resumeEntries: {
            id: string;
            ms: number;
            season?: number;
            episode?: number;
            t?: number;
          }[] = [];
          for (const i of libItems) {
            const mt = Date.parse(i._mtime ?? "");
            if (i.state?.timeOffset && i.state.timeOffset > 0) {
              const vid = i.state.video_id ?? "";
              const kitsuThreeSeg =
                /^(kitsu|mal|anilist|anidb):/.test(i._id) &&
                vid.split(":").length === 3;
              const se = kitsuThreeSeg
                ? null
                : episodeFromVideoId(i.state.video_id);
              const s = i.state.season ?? (kitsuThreeSeg ? 1 : se?.season);
              const e =
                i.state.episode ??
                (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode);
              const local = readResumeEntry(i._id, s, e);
              if (!local || (Number.isFinite(mt) && mt > local.t)) {
                resumeEntries.push({
                  id: i._id,
                  ms: i.state.timeOffset,
                  season: s,
                  episode: e,
                  t: Number.isFinite(mt) ? mt : undefined,
                });
              }
            }
            if ((i.removed && !i.temp) || trackedRef.current.has(i._id))
              continue;
            trackedRef.current.add(i._id);
            if (!Number.isFinite(mt) || Date.now() - mt > 14 * 864e5) continue;
            if (importedSince > 0 && mt <= importedSince) continue;
            const offset = i.state?.timeOffset ?? 0;
            const duration = i.state?.duration ?? 0;
            const progress = duration > 0 ? offset / duration : 0;
            const flagged = (i.state?.flaggedWatched ?? 0) > 0;
            if (flagged || progress > 0.85)
              trackEvent(i._id, "watched", undefined, mt);
            else if (progress > 0.05) trackEvent(i._id, "play", undefined, mt);
            else if (!i.temp) trackEvent(i._id, "watchlist", undefined, mt);
          }
          saveResumeBatch(resumeEntries);
          try {
            localStorage.setItem(importKey, String(Date.now()));
          } catch {}
          void repairLibraryNames(
            authKey,
            libItems,
            user?._id ?? "",
            settings.tmdbKey,
          );
        })
        .catch(console.error);
    };
    load();
    if (active) {
      const refresh = () => {
        if (document.visibilityState === "visible") load();
      };
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", refresh);
      const poll = window.setInterval(() => {
        if (document.visibilityState === "visible") load();
      }, 30000);
      return () => {
        cancelled = true;
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", refresh);
        window.clearInterval(poll);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [authKey, active]);

  const localCwVer = useSyncExternalStore(subscribeLocalCw, localCwVersion);
  const animeDetectVer = useDetectedAnimeVersion();
  const continueWatching = useMemo(() => {
    const localCwItems: LibraryItem[] = listLocalCw().map((e) => ({
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
        video_id:
          e.videoId ??
          (e.season != null && e.episode != null
            ? `${e.id}:${e.season}:${e.episode}`
            : undefined),
        flaggedWatched:
          e.durationMs > 0 && e.positionMs / e.durationMs >= 0.9 ? 1 : 0,
        lastWatched: new Date(e.t).toISOString(),
      },
      removed: false,
      temp: false,
      _ctime: new Date(e.t).toISOString(),
      _mtime: new Date(e.t).toISOString(),
      local: true,
    }));
    const eligible = [...items, ...simklCw, ...localCwItems]
      .filter(
        (i) =>
          (i.type as string) !== "other" &&
          !i._id.startsWith("iptv:") &&
          !isCwDismissed(i) &&
          isCwMember(i) &&
          !(settings.animeOnlyInAnimeRoom && isAnimeCwItem(i)),
      )
      .map((i) => ({ i, k: cwSortKey(i) }))
      .sort((a, b) => b.k - a.k)
      .map((e) => e.i);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim();
    const ns = (id: string) => (id.startsWith("tt") ? "tt" : id.split(":")[0]);
    const seenId = new Set<string>();
    const seenKey = new Map<string, { ns: string; vid: string }>();
    const out: typeof eligible = [];
    for (const i of eligible) {
      if (seenId.has(i._id)) continue;
      const key = `${i.type}:${norm(i.name ?? "")}`;
      const kept = seenKey.get(key);
      const vid = i.state?.video_id ?? "";
      if (kept !== undefined && kept.ns !== ns(i._id) && kept.vid === vid)
        continue;
      seenId.add(i._id);
      if (kept === undefined) seenKey.set(key, { ns: ns(i._id), vid });
      out.push(i);
      if (out.length >= 100) break;
    }
    return out;
  }, [
    items,
    simklCw,
    localCwVer,
    cwVersion,
    settings.animeOnlyInAnimeRoom,
    animeDetectVer,
  ]);
  const cwItems = useCwAdvance(
    continueWatching,
    settings.tmdbKey,
    settings.cwAdvanceNext,
  );

  useEffect(() => {
    void detectAnimeForCw(items);
  }, [items]);

  useEffect(() => {
    publishResumeStates(cwItems);
  }, [cwItems]);

  const onDismissCw = useCallback(
    (item: LibraryItem) => {
      if (item.local) clearLocalCw(item._id);
      else dismissCw(item, authKey);
    },
    [authKey],
  );

  const { items: favItems } = useMediaFavorites();
  const { items: localItems } = useLocalWatchlist();
  const personalRows = useMemo<HomeRow[]>(() => {
    const toMetas = (m: Map<string, MediaEntry>): Meta[] =>
      [...m.values()]
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((e) => ({
          id: e.id,
          type: e.type,
          name: e.name,
          poster: e.poster,
        }));
    const out: HomeRow[] = [];
    if (favItems.size > 0) {
      out.push({
        key: "harbor-favorites",
        type: "movie",
        name: "Favorites",
        metas: toMetas(favItems),
        page: 1,
        hasMore: false,
        noDedup: true,
      });
    }
    if (localItems.size > 0) {
      out.push({
        key: "harbor-watchlist",
        type: "movie",
        name: "My Watchlist",
        metas: toMetas(localItems),
        page: 1,
        hasMore: false,
        noDedup: true,
      });
    }
    return out;
  }, [favItems, localItems]);

  const heroSourceRow = useMemo<HomeRow | null>(() => {
    const key = settings.homeRows.heroSource;
    if (!key) return null;
    const all = [
      ...personalRows,
      ...traktRows,
      ...simklRows,
      ...rows,
      ...animeRows,
    ];
    const hit = all.find((r) => r.key === key);
    return hit && hit.metas.some((m) => m.background || m.poster) ? hit : null;
  }, [
    settings.homeRows.heroSource,
    personalRows,
    traktRows,
    simklRows,
    rows,
    animeRows,
  ]);

  const heroSlides = useMemo<Slide[]>(() => {
    const pool = (
      heroSourceRow
        ? [
            ...heroSourceRow.metas.filter((m) => m.background),
            ...heroSourceRow.metas.filter((m) => !m.background && m.poster),
          ]
        : heroPool
    ).filter((m) => typeof m.id === "string");
    const seen = new Set<string>();
    const out: Slide[] = [];
    for (const m of pool) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push({
        meta: m,
        rank: {
          label: m.type === "series" ? "TV" : "Movies",
          position: out.length + 1,
        },
      });
      if (out.length >= 4) break;
    }
    return out;
  }, [heroPool, heroSourceRow]);

  const scrollRef = useRef<HTMLElement>(null);
  const heroWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = heroWrapperRef.current;
    const main = scrollRef.current;  
    if (!el) return;
    if (!settings.heroFull) {
      el.style.removeProperty("--hero-bleed-x");
      return;
    }
    const measure = () => {
      if (!main) return;
      const mainRect = main.getBoundingClientRect();
      const mainPl = parseFloat(getComputedStyle(main).paddingLeft) || 0;
      el.style.setProperty("--hero-bleed-x", `${mainRect.left + mainPl}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [settings.heroFull, settings.sidebarCollapsed]);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("home", scrollRef, active);

  const { homeResetTick } = useView();
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [homeResetTick]);

  const displayed = useMemo(() => {
    const FIRST_PAGE = 20;
    const seen = new Set<string>();
    for (const s of heroSlides) seen.add(s.meta.id);
    const isClassic = settings.homeMode === "classic";
    if (isClassic) {
      return { top10: [] as Meta[], top10Title: "", rest: rows };
    }
    const firstRow = rows[0];
    const firstRowHead = (firstRow?.metas ?? []).slice(0, FIRST_PAGE);
    const top10 = firstRowHead
      .filter((m) => typeof m.id === "string" && !seen.has(m.id))
      .slice(0, 10);
    for (const m of top10) seen.add(m.id);
    const rest: HomeRow[] = [];
    for (const row of rows.slice(1)) {
      const head = row.metas.slice(0, FIRST_PAGE);
      const tail = row.metas.slice(FIRST_PAGE);
      const filteredHead = row.noDedup
        ? head
        : head.filter((m) => !seen.has(m.id));
      if (!row.noDedup && filteredHead.length < 4) continue;
      for (const m of filteredHead) seen.add(m.id);
      rest.push({ ...row, metas: [...filteredHead, ...tail] });
    }
    return { top10, top10Title: firstRow?.name ?? "", rest };
  }, [rows, heroSlides, settings.homeMode]);

  const top10 = displayed.top10;
  const restRows = displayed.rest;

  const homeRowsCustom = settings.homeRows;

  const sourceRows = useMemo<HomeRow[]>(() => {
    const uniqueSources = new Map<string, SourceRow>();
    for (const sr of homeRowsCustom.customSources || []) {
      if (!uniqueSources.has(sr.id)) uniqueSources.set(sr.id, sr);
    }
    return Array.from(uniqueSources.values()).map((sr) => ({
      key: `source-${sr.id}`,
      type: "movie",
      name: sr.title,
      metas: [],
      page: 1,
      hasMore: false,
      sourceRow: sr,
      noDedup: true,
    }));
  }, [homeRowsCustom.customSources]);

  const allCustomizableRows = useMemo(
    () => [
      ...sourceRows,
      ...arabicRows,
      ...personalRows,
      ...traktRows,
      ...simklRows,
      ...restRows,
      ...animeRows,
    ],
    [
      sourceRows,
      arabicRows,
      personalRows,
      traktRows,
      simklRows,
      restRows,
      animeRows,
    ],
  );
  const visibleRows = useMemo(
    () => applyHomeRowCustomization(allCustomizableRows, homeRowsCustom, false),
    [allCustomizableRows, homeRowsCustom],
  );
  const editRows = useMemo(
    () => applyHomeRowCustomization(allCustomizableRows, homeRowsCustom, true),
    [allCustomizableRows, homeRowsCustom],
  );
  const orderKeys = useMemo(
    () => effectiveOrder(editRows, homeRowsCustom),
    [editRows, homeRowsCustom],
  );

  const mutateHomeRows = useCallback(
    (next: HomeRowCustomization) => update({ homeRows: next }),
    [update],
  );
  const handleMove = useCallback(
    (key: string, delta: -1 | 1) =>
      mutateHomeRows(moveRow(homeRowsCustom, editRows, key, delta)),
    [homeRowsCustom, editRows, mutateHomeRows],
  );
  const handleToggleHidden = useCallback(
    (key: string) => mutateHomeRows(toggleRowHidden(homeRowsCustom, key)),
    [homeRowsCustom, mutateHomeRows],
  );
  const handleRename = useCallback(
    (key: string, label: string) =>
      mutateHomeRows(renameRow(homeRowsCustom, key, label)),
    [homeRowsCustom, mutateHomeRows],
  );
  const handleToggleNumerals = useCallback(
    (key: string) => mutateHomeRows(toggleRowNumerals(homeRowsCustom, key)),
    [homeRowsCustom, mutateHomeRows],
  );
  const handleToggleHero = useCallback(
    (key: string) => mutateHomeRows(toggleHeroSource(homeRowsCustom, key)),
    [homeRowsCustom, mutateHomeRows],
  );

  const handleSaveCustomSources = useCallback(
    (newSources: SourceRow[]) => {
      const existing = homeRowsCustom.customSources || [];
      const next = [...existing];
      for (const ns of newSources) {
        const idx = next.findIndex((s) => s.id === ns.id);
        if (idx >= 0) {
          next[idx] = ns;
        } else {
          next.push(ns);
        }
      }
      mutateHomeRows({ ...homeRowsCustom, customSources: next });
    },
    [homeRowsCustom, mutateHomeRows],
  );

  const handleDeleteCustomSource = useCallback(
    (key: string) => {
      const id = key.replace(/^source-/, "");
      mutateHomeRows({
        ...homeRowsCustom,
        customSources: (homeRowsCustom.customSources || []).filter(
          (sr) => sr.id !== id,
        ),
      });
    },
    [homeRowsCustom, mutateHomeRows],
  );

  const handleEditFolderImages = useCallback(
    (
      sourceId: string,
      folderId: string,
      coverImageUrl: string,
      focusGifUrl: string,
    ) => {
      mutateHomeRows({
        ...homeRowsCustom,
        customSources: (homeRowsCustom.customSources || []).map((sr) => {
          if (sr.id !== sourceId) return sr;
          return {
            ...sr,
            folders: sr.folders.map((f) => {
              if (f.id !== folderId) return f;
              return {
                ...f,
                coverImageUrl: coverImageUrl || null,
                focusGifUrl: focusGifUrl || null,
              };
            }),
          };
        }),
      });
    },
    [homeRowsCustom, mutateHomeRows],
  );

  const enabledServices = useMemo(
    () =>
      settings.tmdbKey
        ? (Object.keys(settings.streaming) as StreamingService[]).filter(
            (s) => settings.streaming[s],
          )
        : [],
    [settings.tmdbKey, settings.streaming],
  );

  return (
    <main
      ref={scrollCb}
      className="flex-1 overflow-y-auto px-5 pt-24 pb-14 sm:px-8 lg:px-12 lg:pt-28"
    >
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="relative flex flex-col gap-12">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
            <div className="pointer-events-auto">
              <TmdbNudge
                suppress={
                  tmdbProvidedByAddon || settings.homeMode === "classic"
                }
              />
            </div>
          </div>
          {editMode && (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
              <div className="pointer-events-auto rounded-xl border border-edge-soft bg-canvas/95 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md">
                <CustomizeBar
                  editMode={editMode}
                  customization={homeRowsCustom}
                  onToggleEdit={() => setEditMode((v) => !v)}
                  onReset={() => mutateHomeRows(resetHomeRows())}
                  onAddSource={() => setAddSourceModalOpen(true)}
                />
              </div>
            </div>
          )}
          {settings.homeMode !== "classic" &&
            !homeRowsCustom.hidden.includes("hero") && (
              <div
                ref={heroWrapperRef}
                data-scroll-anchor="hero"
                className={`relative ${settings.heroFull ? "-mt-24 lg:-mt-28 harbor-hero-full" : ""}`}
              >
                {editMode && (
                  <PinnedRowControls
                    label={t("Featured hero")}
                    hidden={false}
                    onToggleHidden={() => handleToggleHidden("hero")}
                  />
                )}
                <HeroCarousel
                  slides={heroSlides}
                  full={settings.heroFull}
                  fullQuality={settings.heroFullQuality}
                />
                {!editMode && (
                  <div className="pointer-events-none absolute -bottom-3 end-5 z-20 flex justify-end [&>*]:pointer-events-auto">
                    <CustomizeBar
                      editMode={editMode}
                      customization={homeRowsCustom}
                      onToggleEdit={() => setEditMode((v) => !v)}
                      onReset={() => mutateHomeRows(resetHomeRows())}
                    />
                  </div>
                )}
              </div>
            )}
          {editMode && homeRowsCustom.hidden.includes("hero") && (
            <PinnedRowControls
              label={t("Featured hero")}
              hidden
              onToggleHidden={() => handleToggleHidden("hero")}
            />
          )}
          {!editMode &&
            settings.homeMode !== "classic" &&
            homeRowsCustom.hidden.includes("hero") && (
              <div className="pointer-events-none absolute end-5 top-0 z-20 [&>*]:pointer-events-auto">
                <CustomizeBar
                  editMode={editMode}
                  customization={homeRowsCustom}
                  onToggleEdit={() => setEditMode((v) => !v)}
                  onReset={() => mutateHomeRows(resetHomeRows())}
                />
              </div>
            )}
          <div data-scroll-anchor="cw">
            <CWSection
              signedIn={!!authKey}
              items={cwItems}
              watchedSet={traktWatched}
              onDismiss={onDismissCw}
            />
          </div>
          {settings.homeMode !== "classic" && (
            <div data-scroll-anchor="streaming">
              <StreamingRail services={enabledServices} />
            </div>
          )}
          {settings.homeMode !== "classic" &&
            top10.length >= 10 &&
            !homeRowsCustom.hidden.includes("top10") && (
              <div data-scroll-anchor="top10">
                {editMode && (
                  <PinnedRowControls
                    label={t("Top 10 Trending This Week")}
                    hidden={false}
                    onToggleHidden={() => handleToggleHidden("top10")}
                  />
                )}
                <Row
                  title={
                    rows[0].name.toLowerCase().includes("top")
                      ? t(rows[0].name)
                      : t("Top 10 {name}", { name: t(rows[0].name) })
                  }
                  min={180}
                  shape="rank"
                >
                  {top10.map((m, i) => (
                    <TopRankCard key={m.id} meta={m} rank={i + 1} />
                  ))}
                </Row>
              </div>
            )}
          {editMode &&
            settings.homeMode !== "classic" &&
            top10.length >= 10 &&
            homeRowsCustom.hidden.includes("top10") && (
              <PinnedRowControls
                label={t("Top 10 Trending This Week")}
                hidden
                onToggleHidden={() => handleToggleHidden("top10")}
              />
            )}
          {settings.homeMode !== "classic" &&
            settings.tmdbKey &&
            !homeRowsCustom.hidden.includes("collections") && (
              <div data-scroll-anchor="collections">
                {editMode && (
                  <PinnedRowControls
                    label={t("Collections")}
                    hidden={false}
                    onToggleHidden={() => handleToggleHidden("collections")}
                  />
                )}
                <CollectionsRow />
              </div>
            )}
          {editMode &&
            settings.homeMode !== "classic" &&
            settings.tmdbKey &&
            homeRowsCustom.hidden.includes("collections") && (
              <PinnedRowControls
                label={t("Collections")}
                hidden
                onToggleHidden={() => handleToggleHidden("collections")}
              />
            )}
          {rows.length === 0 &&
          traktRows.length === 0 &&
          simklRows.length === 0 &&
          animeRows.length === 0 &&
          arabicRows.length === 0 ? (
            Array.from({ length: 7 }).map((_, i) => (
              <RowSkeleton key={`skel-${i}`} />
            ))
          ) : (
            <CustomizableRows
              rows={editMode ? editRows : visibleRows}
              editMode={editMode}
              customization={homeRowsCustom}
              orderKeys={orderKeys}
              onMove={handleMove}
              onToggleHidden={handleToggleHidden}
              onRename={handleRename}
              onToggleNumerals={handleToggleNumerals}
              onToggleHero={handleToggleHero}
              onLoadMore={loadMore}
              onDeleteCustomSource={handleDeleteCustomSource}
              onEditFolderImages={handleEditFolderImages}
              hideWatched={settings.hideWatchedInCatalogs}
              watchedSet={traktWatched}
              localWatched={localWatched}
              homeLanguages={settings.homeLanguages}
            />
          )}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />

      <AddSourceModal
        isOpen={isAddSourceModalOpen}
        onClose={() => setAddSourceModalOpen(false)}
        onSave={handleSaveCustomSources}
      />
    </main>
  );
}

function PinnedRowControls({
  label,
  hidden,
  onToggleHidden,
}: {
  label: string;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-edge-soft/60 bg-elevated/40 px-4 py-2">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-accent">
          {t("Pinned")}
        </span>
        {label}
        {hidden && (
          <span className="text-[11.5px] font-normal text-ink-subtle">
            {t("· currently hidden")}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onToggleHidden}
        className="h-8 rounded-md border border-edge-soft/60 bg-canvas/70 px-3 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        {hidden ? t("Show") : t("Hide")}
      </button>
    </div>
  );
}
