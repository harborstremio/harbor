import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackToTop } from "@/components/back-to-top";
import { CollectionsRow } from "@/components/collections-row";
import { CriticsPick } from "@/components/critics-pick";
import { BrandTiles } from "@/components/brand-tiles";
import { DiscoveryQueueCta } from "@/components/discovery-queue-cta";
import { TopPeopleCta } from "@/components/top-people-cta";
import { FeaturedBanner } from "@/components/featured-banner";
import { AwardTiles } from "@/components/award-tiles";
import { GenreTiles } from "@/components/genre-tiles";
import { LanguageTiles } from "@/components/language-tiles";
import { Row, ScrollRootContext } from "@/components/row";
import { PickCard } from "@/components/pick-card";
import type { Meta } from "@/lib/cinemeta";
import {
  useHideAnime,
  useHideAnimeMetas,
  useHideAnimeRows,
  useHideAnimeSlides,
} from "@/lib/anime-hide";
import { metaLooksAnime, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { fetchCriticsPickList, getPool, selectDailyRows, type FeedItem } from "@/lib/feed";
import {
  buildFeatured,
  buildFeaturedFast,
  rescoreFeatured,
  type FeaturedResult,
} from "@/lib/feed/featured";
import type { FeaturedItem } from "@/lib/feed/featured/types";
import { prewarmExternalWatched, subscribeExternalWatched } from "@/lib/feed/external-watched";
import { getStore, subscribe as subscribeTaste } from "@/lib/discover/store";
import { getDownvotedIds, getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
import { recentlyPlayed, subscribePlayback, watchTitleKey } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";
import { useContentDrag } from "@/lib/window-drag";
import { useScrollMemory } from "@/lib/view";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { buildLetterboxdHomeRows } from "@/lib/stremboxd/home-rails";
import { LetterboxdRowMenu } from "@/components/letterboxd/letterboxd-row-menu";
import { Rail } from "./discover/discover-rail";
import { useDedupedRows } from "./discover/use-deduped-rows";
import { ANCHOR_AWARDS, ANCHOR_TOP_RATED } from "@/lib/feed/daily-rows-anchors";
import type { HomeRow } from "./home/home-types";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { CatalogBrowser } from "@/views/discover/catalog-browser";
import { SurpriseMe } from "@/views/discover/surprise-me";
import { VoyageBanner } from "@/components/voyage/voyage-banner";
import { SectionEditBar } from "@/views/discover/section-edit-bar";
import { RowControls } from "@/views/home/row-controls";
import { useT } from "@/lib/i18n";
import {
  applyPageRows,
  hasPageRowChanges,
  movePageRow,
  orderedRowKeys,
  renamePageRow,
  resetPageRows,
  togglePageRowHidden,
  usePageRows,
} from "@/lib/page-rows";

const MAX_RAIL_PAGES = 10;
const MIN_PAGE_YIELD = 4;
const ROW_COUNT = 14;
const DEDUP_PRIORITY = [ANCHOR_TOP_RATED, ANCHOR_AWARDS];

type RowItem = { key: string; title: string };

const SPECIAL_ROWS: Array<RowItem & { after: number }> = [
  { key: "special:genres", title: "Browse by Genre", after: 0 },
  { key: "special:queue", title: "Your Discovery Queue", after: 1 },
  { key: "special:languages", title: "Browse by Language", after: 2 },
  { key: "special:collections", title: "Collections", after: 2 },
  { key: "special:critics", title: "Critics' Pick", after: 3 },
  { key: "special:studios", title: "Top studios", after: 3 },
  { key: "special:awards", title: "Browse by Award", after: 4 },
  { key: "special:networks", title: "Top networks", after: 4 },
  { key: "special:people", title: "Top People", after: -1 },
];

const isSpecialRow = (key: string) => key.startsWith("special:");

export function Discover({ active = true }: { active?: boolean }) {
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("discover", scrollRef, active);

  const { settings } = useSettings();
  const contentDrag = useContentDrag();
  const letterboxd = useLetterboxd();
  const t = useT();
  const pageRows = usePageRows("discover");
  const [feat, setFeat] = useState<FeaturedResult>({ featured: [], reserve: [], pool: [] });
  const [featReady, setFeatReady] = useState(false);
  const featured = feat.featured;
  const poolRef = useRef<FeaturedItem[]>([]);
  poolRef.current = feat.pool;
  const [queue, setQueue] = useState<FeedItem[]>([]);
  const [criticsPickList, setCriticsPickList] = useState<Meta[]>([]);
  const [tasteVersion, setTasteVersion] = useState(0);
  const [rails, setRails] = useState<Record<string, Meta[]>>({});
  const [letterboxdRows, setLetterboxdRows] = useState<HomeRow[]>([]);

  useEffect(() => {
    if (!letterboxd.isActive) {
      setLetterboxdRows([]);
      return;
    }
    if (letterboxd.mode === "full" && !letterboxd.session) {
      setLetterboxdRows([]);
      return;
    }
    if (letterboxd.mode === "public" && !letterboxd.configSegment) {
      setLetterboxdRows([]);
      return;
    }
    let cancelled = false;
    buildLetterboxdHomeRows({
      configSegment: letterboxd.configSegment,
      selectedCatalogs: letterboxd.selectedCatalogs,
      hiddenCatalogs: letterboxd.hiddenCatalogs,
      catalogOrder: letterboxd.catalogOrder,
      session: letterboxd.session,
      listRefs: letterboxd.listRefs,
    })
      .then((rs) => {
        if (!cancelled) setLetterboxdRows(rs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    letterboxd.isActive,
    letterboxd.mode,
    letterboxd.configSegment,
    letterboxd.selectedCatalogs,
    letterboxd.hiddenCatalogs,
    letterboxd.catalogOrder,
    letterboxd.session,
    letterboxd.listRefs,
  ]);
  const railPagesRef = useRef<Record<string, number>>({});
  const railExhaustedRef = useRef<Record<string, boolean>>({});
  const railLoadingRef = useRef<Record<string, boolean>>({});
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  epochRef.current = epoch;

  const dailyRows = useMemo(
    () => selectDailyRows(settings.tmdbKey, getStore().affinity, settings, ROW_COUNT),
    [
      settings.tmdbKey,
      settings.region,
      settings.streaming,
      settings.preferredLanguages,
      settings.tmdbLanguage,
      settings.feedLocaleBias,
      settings.uiLanguage,
      tasteVersion,
    ],
  );
  const rowSig = useMemo(() => dailyRows.map((r) => r.id).join("|"), [dailyRows]);

  useEffect(() => {
    let cancelled = false;
    let full = false;
    setFeatReady(false);
    setFeat({ featured: [], reserve: [], pool: [] });
    const fastDone = buildFeaturedFast(settings.tmdbKey, settings)
      .then((r) => {
        if (!cancelled && !full) setFeat(rescoreFeatured(r.pool));
      })
      .catch(() => {});
    const warmDone = prewarmExternalWatched()
      .then(() => !cancelled && setFeat((prev) => rescoreFeatured(prev.pool)))
      .catch(() => {});
    let warmTimer = 0;
    const warmCap = new Promise<void>((res) => {
      warmTimer = window.setTimeout(res, 4000);
    });
    const historyReady = Promise.race([warmDone, warmCap]);
    // Show the eligible fast pool without waiting for every personalized lane.
    void Promise.allSettled([fastDone, historyReady]).then(() => !cancelled && setFeatReady(true));
    // Give the fast pool's identity lookups the queue before the larger build.
    void fastDone.then(async () => {
      if (cancelled) return;
      try {
        const r = await buildFeatured(settings.tmdbKey, settings);
        if (cancelled) return;
        full = true;
        setFeat(rescoreFeatured(r.pool));
      } catch {
        // A failed enrichment must not discard usable fast results.
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(warmTimer);
    };
  }, [
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.region,
    settings.feedLocaleBias,
    settings.preferredLanguages,
  ]);

  useEffect(() => {
    let cancelled = false;
    const hidden = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
    getPool(settings.tmdbKey).then(async (p) => {
      if (cancelled) return;
      const { filterQueuePool } = await import("@/lib/feed/skipped");
      setQueue(filterQueuePool(p).filter((it) => !hidden.has(it.meta.id)));
    });
    fetchCriticsPickList(settings.tmdbKey, settings).then(
      (list) => !cancelled && setCriticsPickList(list.filter((x) => !hidden.has(x.id))),
    );
    return () => {
      cancelled = true;
    };
  }, [
    settings.tmdbKey,
    settings.region,
    settings.feedLocaleBias,
    settings.preferredLanguages,
    settings.tmdbLanguage,
    tasteVersion,
  ]);

  useEffect(() => {
    let timer = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setTasteVersion((v) => v + 1), 600);
    };
    const rescore = () => setFeat(rescoreFeatured(poolRef.current));
    const dropWatchedRails = () => {
      const watched = recentlyPlayed();
      if (watched.ids.size === 0 && watched.titles.size === 0) return;
      const isWatched = (m: Meta) =>
        watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
      setQueue((prev) => {
        const next = prev.filter((it) => !isWatched(it.meta));
        return next.length === prev.length ? prev : next;
      });
      setCriticsPickList((prev) => {
        const next = prev.filter((m) => !isWatched(m));
        return next.length === prev.length ? prev : next;
      });
    };
    const offTaste = subscribeTaste(() => {
      rescore();
      bump();
    });
    const offPrefs = subscribePrefs(() => {
      rescore();
      const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
      setQueue((prev) => prev.filter((it) => !blocked.has(it.meta.id)));
      setCriticsPickList((prev) => prev.filter((m) => !blocked.has(m.id)));
      bump();
    });
    const offPlayback = subscribePlayback(() => {
      rescore();
      dropWatchedRails();
      bump();
    });
    const offExternal = subscribeExternalWatched(rescore);
    return () => {
      clearTimeout(timer);
      offTaste();
      offPrefs();
      offPlayback();
      offExternal();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    startTransition(() => {
      setFeat((prev) => (prev.pool.length ? rescoreFeatured(prev.pool) : prev));
      const watched = recentlyPlayed();
      if (watched.ids.size === 0 && watched.titles.size === 0) return;
      const isWatched = (m: Meta) =>
        watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
      setQueue((prev) => prev.filter((it) => !isWatched(it.meta)));
      setCriticsPickList((prev) => prev.filter((m) => !isWatched(m)));
    });
  }, [active]);

  const ensureLoaded = useCallback(
    (railId: string) => {
      if (railPagesRef.current[railId] != null) return;
      if (railLoadingRef.current[railId]) return;
      const def = dailyRows.find((r) => r.id === railId);
      if (!def) return;
      const myEpoch = epoch;
      railLoadingRef.current[railId] = true;
      def
        .fetch(1)
        .then((list) => {
          if (epochRef.current !== myEpoch) return;
          railPagesRef.current[railId] = 1;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[railId] = true;
          startTransition(() => setRails((prev) => ({ ...prev, [railId]: list })));
        })
        .catch(() => {
          // Leave the page retryable; a transport failure is not an empty catalog.
        })
        .finally(() => {
          if (epochRef.current === myEpoch) railLoadingRef.current[railId] = false;
        });
    },
    [dailyRows, epoch],
  );

  const ensureLoadedRef = useRef(ensureLoaded);
  ensureLoadedRef.current = ensureLoaded;

  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    setRails({});
    railPagesRef.current = {};
    railExhaustedRef.current = {};
    railLoadingRef.current = {};
    epochRef.current += 1;
    setEpoch(epochRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSig, settings.tmdbKey, settings.region, settings.streaming, settings.tmdbLanguage]);

  useEffect(() => {
    if (!active) return;
    for (const id of DEDUP_PRIORITY) ensureLoadedRef.current(id);
  }, [epoch, active]);

  const loadMore = useCallback(
    (railId: string) => {
      if (railPagesRef.current[railId] == null) return;
      if (railLoadingRef.current[railId]) return;
      if (railExhaustedRef.current[railId]) return;
      const cur = railPagesRef.current[railId] ?? 1;
      if (cur >= MAX_RAIL_PAGES) return;
      const def = dailyRows.find((r) => r.id === railId);
      if (!def) return;
      const next = cur + 1;
      const myEpoch = epoch;
      railLoadingRef.current[railId] = true;
      def
        .fetch(next)
        .then((list) => {
          if (epochRef.current !== myEpoch) return;
          railPagesRef.current[railId] = next;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[railId] = true;
          startTransition(() =>
            setRails((prev) => ({ ...prev, [railId]: [...(prev[railId] ?? []), ...list] })),
          );
        })
        .catch(() => {})
        .finally(() => {
          if (epochRef.current === myEpoch) railLoadingRef.current[railId] = false;
        });
    },
    [dailyRows, epoch],
  );

  const featuredIds = useMemo(() => new Set(featured.map((m) => m.id)), [featured]);

  const criticsPick = useMemo(() => {
    const candidates = criticsPickList.filter(
      (m) => !featuredIds.has(m.id) && m.background && m.description,
    );
    if (candidates.length === 0) {
      return criticsPickList.find((m) => !featuredIds.has(m.id)) ?? null;
    }
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    return candidates[dayOfYear % candidates.length];
  }, [criticsPickList, featuredIds]);

  const order = useMemo(() => dailyRows.map((r) => r.id), [dailyRows]);
  const deduped = useDedupedRows(rails, order, featuredIds, criticsPick?.id, DEDUP_PRIORITY);
  const hideAnime = useHideAnime();
  const animeVersion = useDetectedAnimeVersion();
  const dedupedShown = useMemo(() => {
    if (!hideAnime) return deduped;
    const out: Record<string, Meta[] | null> = {};
    for (const key in deduped) {
      const v = deduped[key];
      out[key] = v ? v.filter((m) => !metaLooksAnime(m)) : v;
    }
    return out;
  }, [hideAnime, deduped, animeVersion]);

  const railItems = useMemo(() => {
    const base: RowItem[] = dailyRows.map((r) => ({ key: r.id, title: r.shelf.title }));
    let peopleAfter = -1;
    base.forEach((it, i) => {
      if (it.key.startsWith("keyword:")) peopleAfter = i;
    });
    if (peopleAfter < 0) peopleAfter = base.length - 1;
    const out: RowItem[] = [];
    base.forEach((it, i) => {
      out.push(it);
      for (const s of SPECIAL_ROWS) {
        if (s.after === i || (s.after === -1 && i === peopleAfter))
          out.push({ key: s.key, title: s.title });
      }
    });
    return out;
  }, [dailyRows]);
  const railKeys = useMemo(() => railItems.map((r) => r.key), [railItems]);
  const visibleRails = useMemo(
    () => applyPageRows(railItems, pageRows.custom, false),
    [railItems, pageRows.custom],
  );
  const editRails = useMemo(
    () =>
      applyPageRows(railItems, pageRows.custom, true).filter((item) => {
        const d = dedupedShown[item.key];
        return isSpecialRow(item.key) || d == null || d.length > 0;
      }),
    [railItems, pageRows.custom, dedupedShown],
  );
  const orderKeys = useMemo(
    () => orderedRowKeys(railKeys, pageRows.custom),
    [railKeys, pageRows.custom],
  );
  const surprisePool = useMemo(() => {
    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const m of [...featured, ...criticsPickList, ...Object.values(rails).flat()]) {
      if (!m.poster || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [featured, criticsPickList, rails]);
  const shownFeatured = useHideAnimeMetas(featured);
  const shownQueue = useHideAnimeSlides(queue);
  const shownLetterboxdRows = useHideAnimeRows(letterboxdRows);
  const shownSurprisePool = useHideAnimeMetas(surprisePool);
  const voyageBannerPool = useMemo(() => {
    const exclude = new Set(featured.map((m) => m.id));
    if (criticsPick) exclude.add(criticsPick.id);
    return shownSurprisePool.filter(
      (m) => !exclude.has(m.id) && !!m.background && m.background !== m.poster,
    );
  }, [shownSurprisePool, featured, criticsPick]);

  const hiddenFeatured = pageRows.custom.hidden.includes("section-featured");
  const hiddenCatalog = pageRows.custom.hidden.includes("section-catalog");
  const hiddenSurprise = pageRows.custom.hidden.includes("section-surprise");
  const customizeBar = (
    <CatalogCustomizeBar
      editMode={pageRows.editMode}
      hasChanges={hasPageRowChanges(pageRows.custom)}
      onToggleEdit={() => pageRows.setEditMode((v) => !v)}
      onReset={() => pageRows.persist(resetPageRows())}
    />
  );

  const renderRow = (item: RowItem) => {
    const renamed = item.key in pageRows.custom.renamed ? item.title : undefined;
    switch (item.key) {
      case "special:genres":
        return <GenreTiles title={renamed} />;
      case "special:queue":
        return shownQueue.length > 0 ? (
          <DiscoveryQueueCta items={shownQueue} title={renamed} />
        ) : null;
      case "special:languages":
        return <LanguageTiles title={renamed} />;
      case "special:collections":
        return settings.tmdbKey ? <CollectionsRow title={renamed} /> : null;
      case "special:critics":
        return criticsPick && !(hideAnime && metaLooksAnime(criticsPick)) ? (
          <CriticsPick meta={criticsPick} title={renamed} />
        ) : null;
      case "special:studios":
        return settings.tmdbKey ? <BrandTiles kind="studio" title={renamed} /> : null;
      case "special:awards":
        return <AwardTiles title={renamed} />;
      case "special:networks":
        return settings.tmdbKey ? <BrandTiles kind="network" title={renamed} /> : null;
      case "special:people":
        return <TopPeopleCta title={renamed} />;
      default:
        return (
          <Rail
            active={active}
            railId={item.key}
            allRails={dailyRows}
            deduped={dedupedShown}
            loadMore={loadMore}
            ensureLoaded={ensureLoaded}
            titleOverride={renamed}
          />
        );
    }
  };

  return (
    <main ref={scrollCb} className="flex-1 overflow-y-auto overflow-x-hidden px-12 pb-20 pt-28">
      <ScrollRootContext.Provider value={scrollEl}>
        <div {...contentDrag} data-context-page-background className="flex flex-col gap-14">
          {pageRows.editMode || !hiddenFeatured ? (
            <div className="relative">
              {pageRows.editMode && (
                <SectionEditBar
                  name={t("Featured & Recommended")}
                  hidden={hiddenFeatured}
                  onToggle={() =>
                    pageRows.persist(togglePageRowHidden(pageRows.custom, "section-featured"))
                  }
                />
              )}
              <div className={hiddenFeatured ? "pointer-events-none opacity-40" : ""}>
                <FeaturedBanner items={featReady ? shownFeatured : []} />
              </div>
              <div className="absolute end-0 bottom-4 z-10">{customizeBar}</div>
            </div>
          ) : (
            <div className="flex justify-end">{customizeBar}</div>
          )}

          {pageRows.editMode ? (
            <div className="flex flex-col gap-4">
              <div>
                <SectionEditBar
                  name={t("Browse your catalogs")}
                  hidden={hiddenCatalog}
                  onToggle={() =>
                    pageRows.persist(togglePageRowHidden(pageRows.custom, "section-catalog"))
                  }
                />
                <div className={hiddenCatalog ? "pointer-events-none opacity-40" : ""}>
                  <CatalogBrowser />
                </div>
              </div>
              <div>
                <SectionEditBar
                  name={t("Can't decide?")}
                  hidden={hiddenSurprise}
                  onToggle={() =>
                    pageRows.persist(togglePageRowHidden(pageRows.custom, "section-surprise"))
                  }
                />
                <div className={hiddenSurprise ? "pointer-events-none opacity-40" : ""}>
                  <SurpriseMe pool={shownSurprisePool} />
                </div>
              </div>
            </div>
          ) : (
            (!hiddenCatalog || !hiddenSurprise) && (
              <div
                className={`flex flex-wrap items-stretch gap-x-6 gap-y-4 ${!hiddenFeatured ? "-mt-8" : ""}`}
              >
                {!hiddenCatalog && <CatalogBrowser />}
                {!hiddenSurprise && <SurpriseMe pool={shownSurprisePool} />}
              </div>
            )
          )}

          {!pageRows.editMode && voyageBannerPool.length >= 3 && (
            <VoyageBanner pool={voyageBannerPool} />
          )}

          {shownLetterboxdRows.map((row, i) => {
            const catalogId = row.key.replace("letterboxd-", "");
            return (
              <Row
                key={row.key}
                title={
                  <>
                    {row.name}
                    <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
                      Letterboxd
                    </span>
                  </>
                }
                titleExtra={
                  <LetterboxdRowMenu
                    canMoveUp={i > 0}
                    canMoveDown={i < shownLetterboxdRows.length - 1}
                    hidden={letterboxd.hiddenCatalogs.includes(catalogId)}
                    onMoveUp={() => letterboxd.moveCatalog(catalogId, -1)}
                    onMoveDown={() => letterboxd.moveCatalog(catalogId, 1)}
                    onToggleHidden={() => letterboxd.toggleHidden(catalogId)}
                  />
                }
                min={148}
                shape="portrait"
                scrollKey={`discover:${row.key}`}
              >
                {row.metas.map((m) => (
                  <PickCard key={m.id} meta={m} />
                ))}
              </Row>
            );
          })}

          {pageRows.editMode
            ? editRails.map((item) => {
                const hidden = pageRows.custom.hidden.includes(item.key);
                const idx = orderKeys.indexOf(item.key);
                return (
                  <div key={item.key}>
                    <RowControls
                      name={item.key in pageRows.custom.renamed ? item.title : t(item.title)}
                      hidden={hidden}
                      canMoveUp={idx > 0}
                      canMoveDown={idx >= 0 && idx < orderKeys.length - 1}
                      onMoveUp={() =>
                        pageRows.persist(movePageRow(pageRows.custom, railKeys, item.key, -1))
                      }
                      onMoveDown={() =>
                        pageRows.persist(movePageRow(pageRows.custom, railKeys, item.key, 1))
                      }
                      onToggleHidden={() =>
                        pageRows.persist(togglePageRowHidden(pageRows.custom, item.key))
                      }
                      onRename={(label) =>
                        pageRows.persist(renamePageRow(pageRows.custom, item.key, label))
                      }
                      onResetName={() =>
                        pageRows.persist(renamePageRow(pageRows.custom, item.key, ""))
                      }
                      isRenamed={item.key in pageRows.custom.renamed}
                    />
                    {!hidden && renderRow(item)}
                  </div>
                );
              })
            : visibleRails.map((item) => <Fragment key={item.key}>{renderRow(item)}</Fragment>)}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

export { Discover as DiscoverView };
