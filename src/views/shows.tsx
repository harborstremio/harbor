import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CatalogRows } from "@/components/catalog/catalog-rows";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { ContinueCard } from "@/components/continue-card";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { PeekHero } from "@/components/peek-hero";
import { Row, ScrollRootContext } from "@/components/row";
import { TmdbNudge } from "@/components/nudge";
import { TopRankCard } from "@/components/top-rank-card";
import { useAuth } from "@/lib/auth";
import { topSeries, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { listPager } from "@/lib/list-pager";
import { CATALOG_REQUEST_TIMEOUT_MS, upsertOrdered, withTimeout } from "@/lib/progressive-rows";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useSettings } from "@/lib/settings";
import { cwSortKey, isAnimeCwItem, isCwMember, library, type LibraryItem } from "@/lib/stremio";
import { clearLocalCw } from "@/lib/local-cw";
import {
  dismissManualWatched,
  manualWatchedLibraryItems,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { useCwAdvance } from "./home/hooks/use-cw-advance";
import { useScrollMemory, useView } from "@/lib/view";
import { buildShowHero, bucketCopy } from "./shows/hero-curation";
import { showSpecs } from "./shows/show-specs";

const HERO_POOL_TARGET = 6;
const MAX_PER_ROW = 30;

type ShowRow = {
  key: string;
  title: string;
  metas: Meta[];
  page: number;
  hasMore: boolean;
  fetcher?: (page: number) => Promise<Meta[]>;
};

export function Shows({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const cwVersion = useCwDismissVersion();
  const { openGrid } = useView();
  const t = useT();
  const pageRows = usePageRows("shows");
  const [hero, setHero] = useState<Meta[]>([]);
  const [rows, setRows] = useState<ShowRow[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const rowsRef = useRef<ShowRow[]>([]);
  const loadingRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useScrollMemory("shows", scrollRef, active);

  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);

  useEffect(() => {
    if (!authKey) {
      setItems([]);
      return;
    }
    library(authKey)
      .then(setItems)
      .catch(() => {});
  }, [authKey]);

  useEffect(() => {
    let cancelled = false;
    setHero([]);
    setRows([]);
    (async () => {
      if (settings.tmdbKey) {
        const specs = showSpecs(settings.tmdbKey);
        const order = specs.map((spec) => spec.key);
        void withTimeout(buildShowHero(settings.tmdbKey), CATALOG_REQUEST_TIMEOUT_MS)
          .then((heroPool) => {
            if (!cancelled) setHero(heroPool);
          })
          .catch(() => {});
        const results = await Promise.allSettled(
          specs.map(async (spec) => {
            const metas = await withTimeout(spec.fetcher(1), CATALOG_REQUEST_TIMEOUT_MS);
            if (cancelled || metas.length === 0) return false;
            const row: ShowRow = {
              key: spec.key,
              title: spec.title,
              metas,
              page: 1,
              hasMore: !spec.noPaginate && metas.length >= 14,
              fetcher: spec.noPaginate ? undefined : spec.fetcher,
            };
            setRows((current) => upsertOrdered(current, row, order));
            return true;
          }),
        );
        if (cancelled) return;
        if (results.some((result) => result.status === "fulfilled" && result.value)) return;
      }
      {
        const genreList = [
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
        ];
        const [top, ...byGenre] = await Promise.all([
          withTimeout(topSeries(), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
          ...genreList.map((g) =>
            withTimeout(topSeries(g), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
          ),
        ]);
        if (cancelled) return;
        setHero(top.filter((m) => m.background).slice(0, HERO_POOL_TARGET));
        const built: ShowRow[] = [
          {
            key: "cinemeta-top",
            title: "Top Series",
            metas: top.slice(0, 30),
            page: 1,
            hasMore: false,
            fetcher: listPager(top),
          },
        ];
        for (let i = 0; i < genreList.length; i++) {
          const list = byGenre[i] ?? [];
          if (list.length === 0) continue;
          built.push({
            key: `cinemeta-genre-${genreList[i].toLowerCase().replace(/[^a-z]/g, "")}`,
            title: `Top ${genreList[i]}`,
            metas: list.slice(0, 30),
            page: 1,
            hasMore: false,
            fetcher: listPager(list),
          });
        }
        setRows(built);
      }
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

  const continueWatching = useMemo(
    () =>
      items
        .filter((i) => i.type === "series" && isCwMember(i) && !isCwDismissed(i))
        .map((i) => ({ i, k: cwSortKey(i) }))
        .sort((a, b) => b.k - a.k)
        .map((e) => e.i)
        .slice(0, 16),
    [items, cwVersion],
  );

  const manualWatchedVer = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const resurfaceLibrary = useMemo(() => {
    const manual = manualWatchedLibraryItems().filter((i) => !isAnimeCwItem(i));
    if (manual.length === 0) return items;
    const cwMemberIds = new Set(items.filter(isCwMember).map((i) => i._id));
    const usable = manual.filter((i) => !cwMemberIds.has(i._id));
    if (usable.length === 0) return items;
    const overrideIds = new Set(usable.map((i) => i._id));
    return [...items.filter((i) => !overrideIds.has(i._id)), ...usable];
  }, [items, manualWatchedVer]);
  const cwItems = useCwAdvance(
    continueWatching,
    settings.tmdbKey,
    settings.cwAdvanceNext,
    resurfaceLibrary,
    "exclude",
    manualWatchedVer,
  );

  useEffect(() => {
    publishResumeStates(cwItems);
  }, [cwItems]);

  const loadMore = useCallback((rowKey: string) => {
    if (loadingRef.current.has(rowKey)) return;
    const row = rowsRef.current.find((r) => r.key === rowKey);
    if (!row || !row.fetcher || !row.hasMore || row.metas.length >= MAX_PER_ROW) return;
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
              hasMore: !reachedCap && more.length > 0,
            };
          }),
        );
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(rowKey);
      });
  }, []);

  const top10 = useMemo(() => {
    const trending = rows.find((r) => r.key === "trending");
    if (!trending) return [] as Meta[];
    return trending.metas.slice(0, 10);
  }, [rows]);

  const restRows = useMemo(() => {
    const seen = new Set<string>();
    for (const m of hero) seen.add(m.id);
    return rows
      .filter((r) => r.key !== "trending" || top10.length === 0)
      .map((r) => ({
        ...r,
        metas: r.metas.filter((m) => !seen.has(m.id)),
      }))
      .filter((r) => r.metas.length >= 4);
  }, [rows, hero, top10.length]);

  return (
    <main ref={scrollCb} className="relative h-full overflow-y-auto bg-canvas">
      <ScrollRootContext.Provider value={scrollEl}>
        <div className="relative flex w-full flex-col gap-12 px-12 pb-32 pt-32">
          <PageMast />
          <div className="relative">
            <PeekHero slides={hero} />
            <div className="absolute bottom-3 end-3 z-20">
              <CatalogCustomizeBar
                editMode={pageRows.editMode}
                hasChanges={hasPageRowChanges(pageRows.custom)}
                onToggleEdit={() => pageRows.setEditMode((v) => !v)}
                onReset={() => pageRows.persist(resetPageRows())}
              />
            </div>
          </div>
          {!settings.tmdbKey && <TmdbNudge />}
          {cwItems.length > 0 && (
            <Row
              title={t("Pick up where you left off")}
              min={260}
              shape="landscape"
              scrollKey="shows:cw"
            >
              {cwItems.map((it) => (
                <ContinueCard
                  key={it._id}
                  item={it}
                  onDismiss={(item) =>
                    item.manualWatched
                      ? dismissManualWatched(item._id)
                      : item.local
                        ? clearLocalCw(item._id)
                        : dismissCw(item, authKey)
                  }
                />
              ))}
            </Row>
          )}
          {top10.length >= 10 && (
            <Row
              title={t("Top 10 Series Today")}
              min={216}
              shape="rank"
              scrollKey="shows:top10"
              onViewAll={(() => {
                const trending = rows.find((r) => r.key === "trending");
                return trending?.fetcher
                  ? () =>
                      openGrid({
                        title: t(trending.title),
                        fetcher: trending.fetcher!,
                        initial: trending.metas,
                      })
                  : undefined;
              })()}
            >
              {top10.slice(0, 10).map((m, i) => (
                <TopRankCard key={m.id} meta={m} rank={i + 1} />
              ))}
            </Row>
          )}
          <CatalogRows
            rows={restRows}
            editMode={pageRows.editMode}
            custom={pageRows.custom}
            onPersist={pageRows.persist}
            scrollPrefix="shows"
            onLoadMore={loadMore}
          />
        </div>
        <BackToTop scrollRef={scrollRef} />
      </ScrollRootContext.Provider>
    </main>
  );
}

function PageMast() {
  const t = useT();
  const copy = bucketCopy();
  return (
    <header data-tauri-drag-region className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.42em] text-ink-subtle">
        {t(copy.kicker)}
      </span>
      <h1 className="font-display text-[44px] font-medium leading-[1.05] tracking-tight text-ink">
        {t(copy.title)}
      </h1>
      <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">{t(copy.subtitle)}</p>
    </header>
  );
}
