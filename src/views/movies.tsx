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
import { useCatalogPage, type CatalogRowSpec } from "@/lib/catalog-page";
import { recentlyPlayed } from "@/lib/playback-history";
import { useT } from "@/lib/i18n";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { buildLetterboxdHomeRows } from "@/lib/stremboxd/home-rails";
import { LetterboxdRowMenu } from "@/components/letterboxd/letterboxd-row-menu";
import type { HomeRow } from "./home/home-types";
import { buildMovieHero, HERO_POOL_TARGET, movieSpecs, rotateDaily } from "./movies/movie-specs";

const MAX_PER_ROW = 30;

const CINEMETA_GENRES = [
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
] as const;

function cinemetaMovieSpecs(): CatalogRowSpec[] {
  return [
    {
      key: "cinemeta-top",
      title: "Top Movies",
      noPaginate: true,
      fetcher: async () => {
        const top = await topMovies().catch(() => [] as Meta[]);
        return top.slice(0, 30);
      },
    },
    ...CINEMETA_GENRES.map(
      (g): CatalogRowSpec => ({
        key: `cinemeta-genre-${g.toLowerCase().replace(/[^a-z]/g, "")}`,
        title: `Top ${g}`,
        noPaginate: true,
        fetcher: async () => {
          const list = await topMovies(g).catch(() => [] as Meta[]);
          return list.slice(0, 30);
        },
      }),
    ),
  ];
}

export function Movies({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const { openGrid } = useView();
  const t = useT();
  const letterboxd = useLetterboxd();
  const pageRows = usePageRows("movies");
  const [letterboxdRows, setLetterboxdRows] = useState<HomeRow[]>([]);
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  const tmdbKey = settings.tmdbKey;
  const region = settings.region;
  const scope = tmdbKey ? `tmdb:${tmdbKey}:${region}` : "cinemeta";

  const specs = useMemo<CatalogRowSpec[]>(
    () => (tmdbKey ? movieSpecs(tmdbKey, region) : cinemetaMovieSpecs()),
    [tmdbKey, region],
  );

  const heroFetcher = useCallback(async () => {
    if (tmdbKey) return buildMovieHero(tmdbKey, recentlyPlayed());
    const top = await topMovies().catch(() => [] as Meta[]);
    return rotateDaily(
      top.filter((m) => m.background),
      HERO_POOL_TARGET,
      recentlyPlayed(),
    );
  }, [tmdbKey]);

  const { hero, rows, loadMore, loading } = useCatalogPage({
    pageId: "movies",
    scope,
    specs,
    heroFetcher,
    enabled: active,
    maxPerRow: MAX_PER_ROW,
  });

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
    return (
      rows
        .filter((r) => r.key !== "trending" || top10.length === 0)
        .map((r) => {
          const dedupedMetas = r.metas.filter((m) => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          return { ...r, metas: dedupedMetas };
        })
        // Keep partial rows while loading; only drop tiny rails once we have content.
        .filter((r) => r.metas.length >= (loading && rows.length < 3 ? 1 : 4))
    );
  }, [rows, hero, top10, loading]);

  return (
    <main ref={scrollCb} className="relative h-full overflow-y-auto bg-canvas">
      <ScrollRootContext.Provider value={scrollEl}>
        {hero.length > 0 ? (
          <CinemaHero slides={hero} eyebrow={t("Featured tonight")} />
        ) : (
          <div className="h-[42vh] min-h-[280px] w-full animate-pulse bg-elevated/40" />
        )}
        <div className="relative flex w-full flex-col gap-12 px-12 pb-32 pt-12">
          <CatalogCustomizeBar
            editMode={pageRows.editMode}
            hasChanges={hasPageRowChanges(pageRows.custom)}
            onToggleEdit={() => pageRows.setEditMode((v) => !v)}
            onReset={() => pageRows.persist(resetPageRows())}
          />
          {!settings.tmdbKey && <TmdbNudge />}
          {loading && restRows.length === 0 && (
            <div className="flex flex-col gap-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="h-5 w-48 animate-pulse rounded bg-elevated/50" />
                  <div className="flex gap-5 overflow-hidden">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-52 w-36 shrink-0 animate-pulse rounded-xl bg-elevated/40"
                        style={{ animationDelay: `${j * 60}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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
