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
import { useCatalogPage, type CatalogRowSpec } from "@/lib/catalog-page";
import { useT } from "@/lib/i18n";
import { publishResumeStates } from "@/lib/hover-preview/store";
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
import { bucketCopy, buildShowHero } from "./shows/hero-curation";
import { showSpecs } from "./shows/show-specs";

const HERO_POOL_TARGET = 6;
const MAX_PER_ROW = 30;

const CINEMETA_GENRES = [
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
] as const;

function cinemetaShowSpecs(): CatalogRowSpec[] {
  return [
    {
      key: "cinemeta-top",
      title: "Top Series",
      noPaginate: true,
      fetcher: async () => {
        const top = await topSeries().catch(() => [] as Meta[]);
        return top.slice(0, 30);
      },
    },
    ...CINEMETA_GENRES.map(
      (g): CatalogRowSpec => ({
        key: `cinemeta-genre-${g.toLowerCase().replace(/[^a-z]/g, "")}`,
        title: `Top ${g}`,
        noPaginate: true,
        fetcher: async () => {
          const list = await topSeries(g).catch(() => [] as Meta[]);
          return list.slice(0, 30);
        },
      }),
    ),
  ];
}

export function Shows({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const cwVersion = useCwDismissVersion();
  const { openGrid } = useView();
  const t = useT();
  const pageRows = usePageRows("shows");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  const tmdbKey = settings.tmdbKey;
  const region = settings.region;
  const scope = tmdbKey ? `tmdb:${tmdbKey}:${region}` : "cinemeta";

  const specs = useMemo<CatalogRowSpec[]>(
    () => (tmdbKey ? showSpecs(tmdbKey) : cinemetaShowSpecs()),
    [tmdbKey],
  );

  const heroFetcher = useCallback(async () => {
    if (tmdbKey) return buildShowHero(tmdbKey);
    const top = await topSeries().catch(() => [] as Meta[]);
    return top.filter((m) => m.background).slice(0, HERO_POOL_TARGET);
  }, [tmdbKey]);

  const { hero, rows, loadMore, loading } = useCatalogPage({
    pageId: "shows",
    scope,
    specs,
    heroFetcher,
    enabled: active,
    maxPerRow: MAX_PER_ROW,
  });

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
      .filter((r) => r.metas.length >= (loading && rows.length < 3 ? 1 : 4));
  }, [rows, hero, top10.length, loading]);

  return (
    <main ref={scrollCb} className="relative h-full overflow-y-auto bg-canvas">
      <ScrollRootContext.Provider value={scrollEl}>
        <div className="relative flex w-full flex-col gap-12 px-12 pb-32 pt-32">
          <PageMast />
          <div className="relative">
            {hero.length > 0 ? (
              <PeekHero slides={hero} />
            ) : (
              <div className="h-[36vh] min-h-[240px] w-full animate-pulse rounded-2xl bg-elevated/40" />
            )}
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
          {loading && restRows.length === 0 && (
            <div className="flex flex-col gap-10">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="h-5 w-48 animate-pulse rounded bg-elevated/50" />
                  <div className="flex gap-5 overflow-hidden">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-52 w-36 shrink-0 animate-pulse rounded-xl bg-elevated/40"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
