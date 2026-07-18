import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CatalogRows } from "@/components/catalog/catalog-rows";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { CinemaHero } from "@/components/cinema-hero";
import { Row, ScrollRootContext } from "@/components/row";
import { TopRankCard } from "@/components/top-rank-card";
import { PickCard } from "@/components/pick-card";
import { TmdbNudge } from "@/components/nudge";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { recentlyPlayed } from "@/lib/playback-history";
import { useT } from "@/lib/i18n";
import { listPager } from "@/lib/list-pager";
import { CATALOG_REQUEST_TIMEOUT_MS, upsertOrdered, withTimeout } from "@/lib/progressive-rows";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { buildLetterboxdHomeRows } from "@/lib/stremboxd/home-rails";
import { LetterboxdRowMenu } from "@/components/letterboxd/letterboxd-row-menu";
import type { HomeRow } from "./home/home-types";
import { buildMovieHero, HERO_POOL_TARGET, movieSpecs, rotateDaily } from "./movies/movie-specs";

const MAX_PER_ROW = 30;

type MovieRow = {
  key: string;
  title: string;
  metas: Meta[];
  page: number;
  hasMore: boolean;
  fetcher?: (page: number) => Promise<Meta[]>;
};

export function Movies({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const { openGrid } = useView();
  const t = useT();
  const letterboxd = useLetterboxd();
  const pageRows = usePageRows("movies");
  const [hero, setHero] = useState<Meta[]>([]);
  const [rows, setRows] = useState<MovieRow[]>([]);
  const [letterboxdRows, setLetterboxdRows] = useState<HomeRow[]>([]);
  const rowsRef = useRef<MovieRow[]>([]);
  const loadingRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useScrollMemory("movies", scrollRef, active);

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

  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHero([]);
    setRows([]);
    (async () => {
      const seen = recentlyPlayed();
      if (settings.tmdbKey) {
        const specs = movieSpecs(settings.tmdbKey, settings.region);
        const order = specs.map((spec) => spec.key);
        void withTimeout(buildMovieHero(settings.tmdbKey, seen), CATALOG_REQUEST_TIMEOUT_MS)
          .then((heroPool) => {
            if (!cancelled) setHero(heroPool);
          })
          .catch(() => {});
        const results = await Promise.allSettled(
          specs.map(async (spec) => {
            const metas = await withTimeout(spec.fetcher(1), CATALOG_REQUEST_TIMEOUT_MS);
            if (cancelled || metas.length === 0) return false;
            const row: MovieRow = {
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
      const genreList = [
        "Action",
        "Drama",
        "Comedy",
        "Sci-Fi",
        "Thriller",
        "Horror",
        "Romance",
        "Animation",
        "Adventure",
        "Crime",
        "Mystery",
        "Fantasy",
        "Documentary",
      ];
      const [top, ...byGenre] = await Promise.all([
        withTimeout(topMovies(), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
        ...genreList.map((g) =>
          withTimeout(topMovies(g), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
        ),
      ]);
      if (cancelled) return;
      setHero(
        rotateDaily(
          top.filter((m) => m.background),
          HERO_POOL_TARGET,
          seen,
        ),
      );
      const built: MovieRow[] = [
        {
          key: "cinemeta-top",
          title: "Top Movies",
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
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, settings.region]);

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
    if (top10.length > 0) {
      for (const m of top10) seen.add(m.id);
    }
    return rows
      .filter((r) => r.key !== "trending" || top10.length === 0)
      .map((r) => {
        const dedupedMetas = r.metas.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        return { ...r, metas: dedupedMetas };
      })
      .filter((r) => r.metas.length >= 4);
  }, [rows, hero, top10]);

  return (
    <main ref={scrollCb} className="relative h-full overflow-y-auto bg-canvas">
      <ScrollRootContext.Provider value={scrollEl}>
        <CinemaHero slides={hero} eyebrow={t("Featured tonight")} />
        <div className="relative flex w-full flex-col gap-12 px-12 pb-32 pt-12">
          <CatalogCustomizeBar
            editMode={pageRows.editMode}
            hasChanges={hasPageRowChanges(pageRows.custom)}
            onToggleEdit={() => pageRows.setEditMode((v) => !v)}
            onReset={() => pageRows.persist(resetPageRows())}
          />
          {!settings.tmdbKey && <TmdbNudge />}
          {letterboxdRows.map((row, i) => {
            const catalogId = row.key.replace("letterboxd-", "");
            return (
              <Row
                key={row.key}
                title={
                  <>
                    {t(row.name)}
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
                scrollKey={`movies:${row.key}`}
                onViewAll={
                  row.fetcher
                    ? () =>
                        openGrid({ title: t(row.name), fetcher: row.fetcher!, initial: row.metas })
                    : undefined
                }
              >
                {row.metas.map((m) => (
                  <PickCard key={m.id} meta={m} />
                ))}
              </Row>
            );
          })}
          {top10.length >= 10 && (
            <Row
              title={t("Top 10 Movies Today")}
              min={216}
              shape="rank"
              scrollKey="movies:top10"
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
            scrollPrefix="movies"
            onLoadMore={loadMore}
            flagRerunKeys={["coming-soon"]}
          />
        </div>
        <BackToTop scrollRef={scrollRef} />
      </ScrollRootContext.Provider>
    </main>
  );
}
