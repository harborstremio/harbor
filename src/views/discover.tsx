import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BackToTop } from "@/components/back-to-top";
import { CollectionsRow } from "@/components/collections-row";
import { CriticsPick } from "@/components/critics-pick";
import { LazyMount } from "@/components/lazy-mount";
import { DiscoveryQueueCta } from "@/components/discovery-queue-cta";
import { FeaturedBanner } from "@/components/featured-banner";
import { AwardTiles } from "@/components/award-tiles";
import { GenreTiles } from "@/components/genre-tiles";
import { LanguageTiles } from "@/components/language-tiles";
import { Row, ScrollRootContext } from "@/components/row";
import { PickCard } from "@/components/pick-card";
import type { Meta } from "@/lib/cinemeta";
import { fetchCriticsPickList, getPool, type FeedItem } from "@/lib/feed";
import {
  buildFeatured,
  buildFeaturedFast,
  rescoreFeatured,
  type FeaturedResult,
} from "@/lib/feed/featured";
import { discoverDailyRows, discoverKeys, discoverScope } from "./discover/discover-queries";
import type { FeaturedItem } from "@/lib/feed/featured/types";
import { prewarmExternalWatched, subscribeExternalWatched } from "@/lib/feed/external-watched";
import { subscribe as subscribeTaste } from "@/lib/discover/store";
import { getDownvotedIds, getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
import { recentlyPlayed, subscribePlayback, watchTitleKey } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";
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
const DEDUP_PRIORITY = [ANCHOR_TOP_RATED, ANCHOR_AWARDS];

export function Discover({ active = true }: { active?: boolean }) {
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("discover", scrollRef, active);

  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const scope = discoverScope(settings);
  const letterboxd = useLetterboxd();
  const t = useT();
  const pageRows = usePageRows("discover");
  const [feat, setFeat] = useState<FeaturedResult>({ featured: [], reserve: [], pool: [] });
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
    () => discoverDailyRows(settings),
    [settings.tmdbKey, settings.region, settings.streaming, tasteVersion],
  );
  const rowSig = useMemo(() => dailyRows.map((r) => r.id).join("|"), [dailyRows]);

  useEffect(() => {
    let cancelled = false;
    let full = false;
    queryClient
      .fetchQuery({
        queryKey: discoverKeys.featuredFast(scope),
        queryFn: () => buildFeaturedFast(settings.tmdbKey, settings),
        staleTime: 5 * 60_000,
      })
      .then((r) => !cancelled && !full && setFeat((prev) => (prev.pool.length ? prev : r)))
      .catch(() => {});
    queryClient
      .fetchQuery({
        queryKey: discoverKeys.featured(scope),
        queryFn: () => buildFeatured(settings.tmdbKey, settings),
        staleTime: 5 * 60_000,
      })
      .then((r) => {
        if (cancelled) return;
        full = true;
        setFeat(r);
      })
      .catch(() => {});
    prewarmExternalWatched()
      .then(() => !cancelled && setFeat((prev) => rescoreFeatured(prev.pool)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.region,
    settings.feedLocaleBias,
    settings.preferredLanguages,
    queryClient,
    scope,
  ]);

  useEffect(() => {
    let cancelled = false;
    const hidden = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
    getPool(settings.tmdbKey).then(async (p) => {
      if (cancelled) return;
      const { filterQueuePool } = await import("@/lib/feed/skipped");
      setQueue(filterQueuePool(p).filter((it) => !hidden.has(it.meta.id)));
    });
    queryClient
      .fetchQuery({
        queryKey: discoverKeys.critics(scope),
        queryFn: () => fetchCriticsPickList(settings.tmdbKey, settings),
        staleTime: 5 * 60_000,
      })
      .then((list) => !cancelled && setCriticsPickList(list.filter((x) => !hidden.has(x.id))))
      .catch(() => {});
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
    queryClient,
    scope,
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
    setFeat((prev) => rescoreFeatured(prev.pool));
    const watched = recentlyPlayed();
    if (watched.ids.size === 0 && watched.titles.size === 0) return;
    const isWatched = (m: Meta) =>
      watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
    setQueue((prev) => prev.filter((it) => !isWatched(it.meta)));
    setCriticsPickList((prev) => prev.filter((m) => !isWatched(m)));
  }, [active]);

  const ensureLoaded = useCallback(
    (railId: string) => {
      if (railPagesRef.current[railId] != null) return;
      if (railLoadingRef.current[railId]) return;
      const def = dailyRows.find((r) => r.id === railId);
      if (!def) return;
      const myEpoch = epoch;
      railLoadingRef.current[railId] = true;
      queryClient
        .fetchQuery({
          queryKey: discoverKeys.rail(scope, railId, 1),
          queryFn: () => def.fetch(1),
          staleTime: 5 * 60_000,
        })
        .then((list) => {
          if (epochRef.current !== myEpoch) return;
          railPagesRef.current[railId] = 1;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[railId] = true;
          setRails((prev) => ({ ...prev, [railId]: list }));
        })
        .catch(() => {
          if (epochRef.current !== myEpoch) return;
          railPagesRef.current[railId] = 1;
          railExhaustedRef.current[railId] = true;
          setRails((prev) => ({ ...prev, [railId]: [] }));
        })
        .finally(() => {
          if (epochRef.current === myEpoch) railLoadingRef.current[railId] = false;
        });
    },
    [dailyRows, epoch, queryClient, scope],
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
    setEpoch((e) => e + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSig, settings.tmdbKey, settings.region, settings.streaming, settings.tmdbLanguage]);

  useEffect(() => {
    for (const id of DEDUP_PRIORITY) ensureLoadedRef.current(id);
  }, [epoch]);

  const loadMore = useCallback(
    (railId: string) => {
      if (railLoadingRef.current[railId]) return;
      if (railExhaustedRef.current[railId]) return;
      const cur = railPagesRef.current[railId] ?? 1;
      if (cur >= MAX_RAIL_PAGES) return;
      const def = dailyRows.find((r) => r.id === railId);
      if (!def) return;
      const next = cur + 1;
      railLoadingRef.current[railId] = true;
      queryClient
        .fetchQuery({
          queryKey: discoverKeys.rail(scope, railId, next),
          queryFn: () => def.fetch(next),
          staleTime: 5 * 60_000,
        })
        .then((list) => {
          railPagesRef.current[railId] = next;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[railId] = true;
          setRails((prev) => ({ ...prev, [railId]: [...(prev[railId] ?? []), ...list] }));
        })
        .catch(() => {})
        .finally(() => {
          railLoadingRef.current[railId] = false;
        });
    },
    [dailyRows, queryClient, scope],
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

  const railItems = useMemo(
    () => dailyRows.map((r) => ({ key: r.id, title: r.shelf.title })),
    [dailyRows],
  );
  const railKeys = useMemo(() => railItems.map((r) => r.key), [railItems]);
  const visibleRails = useMemo(
    () => applyPageRows(railItems, pageRows.custom, false),
    [railItems, pageRows.custom],
  );
  const editRails = useMemo(
    () =>
      applyPageRows(railItems, pageRows.custom, true).filter((item) => {
        const d = deduped[item.key];
        return d == null || d.length > 0;
      }),
    [railItems, pageRows.custom, deduped],
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

  return (
    <main ref={scrollCb} className="flex-1 overflow-y-auto px-12 pb-20 pt-28">
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="flex flex-col gap-14">
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
                <FeaturedBanner items={featured} />
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
                  <SurpriseMe pool={surprisePool} />
                </div>
              </div>
            </div>
          ) : (
            (!hiddenCatalog || !hiddenSurprise) && (
              <div
                className={`flex flex-wrap items-stretch gap-x-6 gap-y-4 ${!hiddenFeatured ? "-mt-8" : ""}`}
              >
                {!hiddenCatalog && <CatalogBrowser />}
                {!hiddenSurprise && <SurpriseMe pool={surprisePool} />}
              </div>
            )
          )}

          {letterboxdRows.map((row, i) => {
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
                    canMoveDown={i < letterboxdRows.length - 1}
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
                      name={t(item.title)}
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
                    {!hidden && (
                      <Rail
                        railId={item.key}
                        allRails={dailyRows}
                        deduped={deduped}
                        loadMore={loadMore}
                        ensureLoaded={ensureLoaded}
                        titleOverride={item.title}
                      />
                    )}
                  </div>
                );
              })
            : visibleRails.map((item, i) => (
                <Fragment key={item.key}>
                  <LazyMount minHeight={340}>
                    <Rail
                      railId={item.key}
                      allRails={dailyRows}
                      deduped={deduped}
                      loadMore={loadMore}
                      ensureLoaded={ensureLoaded}
                      titleOverride={item.title}
                    />
                  </LazyMount>

                  {i === 0 && <GenreTiles />}
                  {i === 1 && queue.length > 0 && <DiscoveryQueueCta items={queue} />}
                  {i === 2 && <LanguageTiles />}
                  {i === 2 && settings.tmdbKey && (
                    <LazyMount minHeight={260}>
                      <CollectionsRow />
                    </LazyMount>
                  )}
                  {i === 3 && criticsPick && (
                    <LazyMount minHeight={580}>
                      <CriticsPick meta={criticsPick} />
                    </LazyMount>
                  )}
                  {i === 4 && <AwardTiles />}
                </Fragment>
              ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

export { Discover as DiscoverView };
