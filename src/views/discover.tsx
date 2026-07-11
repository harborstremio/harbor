import { AwardTiles } from "@/components/award-tiles";
import { BackToTop } from "@/components/back-to-top";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { CollectionsRow } from "@/components/collections-row";
import { CriticsPick } from "@/components/critics-pick";
import { DiscoveryQueueCta } from "@/components/discovery-queue-cta";
import { FeaturedBanner } from "@/components/featured-banner";
import { GenreTiles } from "@/components/genre-tiles";
import { LanguageTiles } from "@/components/language-tiles";
import { LazyMount } from "@/components/lazy-mount";
import { LetterboxdRowMenu } from "@/components/letterboxd/letterboxd-row-menu";
import { PickCard } from "@/components/pick-card";
import { Row, ScrollRootContext } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { getStore, subscribe as subscribeTaste } from "@/lib/discover/store";
import { fetchCriticsPickList, fetchFeatured, getPool, selectDailyRows, type FeedItem } from "@/lib/feed";
import { ANCHOR_AWARDS, ANCHOR_TOP_RATED } from "@/lib/feed/daily-rows-anchors";
import { getDownvotedIds, getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
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
import { recentlyPlayed, subscribePlayback, watchTitleKey } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";
import { buildLetterboxdHomeRows } from "@/lib/stremboxd/home-rails";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { useScrollMemory } from "@/lib/view";
import { CatalogBrowser } from "@/views/discover/catalog-browser";
import { SectionEditBar } from "@/views/discover/section-edit-bar";
import { SurpriseMe } from "@/views/discover/surprise-me";
import { RowControls } from "@/views/home/row-controls";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Rail } from "./discover/discover-rail";
import { useDedupedRows } from "./discover/use-deduped-rows";
import type { HomeRow } from "./home/home-types";

const MAX_RAIL_PAGES = 10;
const MIN_PAGE_YIELD = 4;
const ROW_COUNT = 14;
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
  const letterboxd = useLetterboxd();
  const t = useT();
  const pageRows = usePageRows("discover");
  const [featured, setFeatured] = useState<Meta[]>([]);
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
    [settings.tmdbKey, settings.region, settings.streaming, tasteVersion],
  );
  const rowSig = useMemo(() => dailyRows.map((r) => r.id).join("|"), [dailyRows]);

  useEffect(() => {
    let cancelled = false;
    fetchFeatured(settings.tmdbKey, settings).then((m) => !cancelled && setFeatured(m));
    return () => {
      cancelled = true;
    };
  }, [
    settings.tmdbKey,
    settings.tmdbLanguage,
    settings.region,
    settings.feedLocaleBias,
    settings.preferredLanguages,
    tasteVersion,
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
  }, [settings.tmdbKey, settings.region, settings.feedLocaleBias, settings.preferredLanguages, settings.tmdbLanguage]);

  useEffect(() => {
    let timer = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setTasteVersion((v) => v + 1), 600);
    };
    const dropWatched = () => {
      const watched = recentlyPlayed();
      if (watched.ids.size === 0 && watched.titles.size === 0) return;
      const isWatched = (m: Meta) => watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
      setFeatured((prev) => {
        const next = prev.filter((m) => !isWatched(m));
        return next.length === prev.length ? prev : next;
      });
      setQueue((prev) => {
        const next = prev.filter((it) => !isWatched(it.meta));
        return next.length === prev.length ? prev : next;
      });
      setCriticsPickList((prev) => {
        const next = prev.filter((m) => !isWatched(m));
        return next.length === prev.length ? prev : next;
      });
    };
    const offTaste = subscribeTaste(bump);
    const offPrefs = subscribePrefs(() => {
      const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
      setFeatured((prev) => prev.filter((m) => !blocked.has(m.id)));
      setQueue((prev) => prev.filter((it) => !blocked.has(it.meta.id)));
      setCriticsPickList((prev) => prev.filter((m) => !blocked.has(m.id)));
      bump();
    });
    const offPlayback = subscribePlayback(() => {
      dropWatched();
      bump();
    });
    return () => {
      clearTimeout(timer);
      offTaste();
      offPrefs();
      offPlayback();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const watched = recentlyPlayed();
    if (watched.ids.size === 0 && watched.titles.size === 0) return;
    const isWatched = (m: Meta) => watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
    setFeatured((prev) => prev.filter((m) => !isWatched(m)));
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
      def
        .fetch(1)
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
      def
        .fetch(next)
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
    [dailyRows],
  );

  const featuredIds = useMemo(() => new Set(featured.map((m) => m.id)), [featured]);

  const criticsPick = useMemo(() => {
    const candidates = criticsPickList.filter((m) => !featuredIds.has(m.id) && m.background && m.description);
    if (candidates.length === 0) {
      return criticsPickList.find((m) => !featuredIds.has(m.id)) ?? null;
    }
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86_400_000);
    return candidates[dayOfYear % candidates.length];
  }, [criticsPickList, featuredIds]);

  const order = useMemo(() => dailyRows.map((r) => r.id), [dailyRows]);
  const deduped = useDedupedRows(rails, order, featuredIds, criticsPick?.id, DEDUP_PRIORITY);

  const railItems = useMemo(() => dailyRows.map((r) => ({ key: r.id, title: r.shelf.title })), [dailyRows]);
  const railKeys = useMemo(() => railItems.map((r) => r.key), [railItems]);
  const visibleRails = useMemo(() => applyPageRows(railItems, pageRows.custom, false), [railItems, pageRows.custom]);
  const editRails = useMemo(
    () =>
      applyPageRows(railItems, pageRows.custom, true).filter((item) => {
        const d = deduped[item.key];
        return d == null || d.length > 0;
      }),
    [railItems, pageRows.custom, deduped],
  );
  const orderKeys = useMemo(() => orderedRowKeys(railKeys, pageRows.custom), [railKeys, pageRows.custom]);
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
                  onToggle={() => pageRows.persist(togglePageRowHidden(pageRows.custom, "section-featured"))}
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
                  onToggle={() => pageRows.persist(togglePageRowHidden(pageRows.custom, "section-catalog"))}
                />
                <div className={hiddenCatalog ? "pointer-events-none opacity-40" : ""}>
                  <CatalogBrowser />
                </div>
              </div>
              <div>
                <SectionEditBar
                  name={t("Can't decide?")}
                  hidden={hiddenSurprise}
                  onToggle={() => pageRows.persist(togglePageRowHidden(pageRows.custom, "section-surprise"))}
                />
                <div className={hiddenSurprise ? "pointer-events-none opacity-40" : ""}>
                  <SurpriseMe pool={surprisePool} />
                </div>
              </div>
            </div>
          ) : (
            (!hiddenCatalog || !hiddenSurprise) && (
              <div className={`flex flex-wrap items-stretch gap-x-6 gap-y-4 ${!hiddenFeatured ? "-mt-8" : ""}`}>
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
                      onMoveUp={() => pageRows.persist(movePageRow(pageRows.custom, railKeys, item.key, -1))}
                      onMoveDown={() => pageRows.persist(movePageRow(pageRows.custom, railKeys, item.key, 1))}
                      onToggleHidden={() => pageRows.persist(togglePageRowHidden(pageRows.custom, item.key))}
                      onRename={(label) => pageRows.persist(renamePageRow(pageRows.custom, item.key, label))}
                      onResetName={() => pageRows.persist(renamePageRow(pageRows.custom, item.key, ""))}
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
