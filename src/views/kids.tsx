import { useCallback, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CatalogRows } from "@/components/catalog/catalog-rows";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { ScrollRootContext } from "@/components/row";
import { TmdbNudge } from "@/components/nudge";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { useCatalogPage, type CatalogRowSpec } from "@/lib/catalog-page";
import { recentlyPlayed } from "@/lib/playback-history";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { KidsDoodles } from "./kids/kids-doodles";
import { dropAdultContent, dropUnreleased, dropUnsafeCinemetaKids } from "./kids/kids-filter";
import { KidsFranchiseRail } from "./kids/kids-franchise-rail";
import { KidsHero } from "./kids/kids-hero";
import { buildKidsHero, kidsSpecs } from "./kids/kids-specs";

const MAX_PER_ROW = 120;

function cinemetaKidsSpecs(): CatalogRowSpec[] {
  return [
    {
      key: "cinemeta-animation",
      title: "Animated Movies",
      noPaginate: true,
      fetcher: async () =>
        topMovies("Animation")
          .then(dropUnreleased)
          .then(dropUnsafeCinemetaKids)
          .catch(() => [] as Meta[]),
    },
    {
      key: "cinemeta-family",
      title: "Family Movies",
      noPaginate: true,
      fetcher: async () =>
        topMovies("Family")
          .then(dropUnreleased)
          .then(dropUnsafeCinemetaKids)
          .catch(() => [] as Meta[]),
    },
  ];
}

export function Kids({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const pageRows = usePageRows("kids");
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  const tmdbKey = settings.tmdbKey;
  const scope = tmdbKey ? `tmdb:${tmdbKey}` : "cinemeta";

  const specs = useMemo<CatalogRowSpec[]>(
    () => (tmdbKey ? kidsSpecs(tmdbKey) : cinemetaKidsSpecs()),
    [tmdbKey],
  );

  const heroFetcher = useCallback(async () => {
    if (tmdbKey) {
      const pool = await buildKidsHero(tmdbKey, recentlyPlayed()).catch(() => [] as Meta[]);
      return dropAdultContent(dropUnreleased(pool));
    }
    const animation = await topMovies("Animation")
      .then(dropUnreleased)
      .then(dropUnsafeCinemetaKids)
      .catch(() => [] as Meta[]);
    return animation.filter((m) => m.background).slice(0, 5);
  }, [tmdbKey]);

  const mapMetas = useCallback((metas: Meta[]) => dropAdultContent(dropUnreleased(metas)), []);

  const { hero, rows, loadMore } = useCatalogPage({
    pageId: "kids",
    scope,
    specs,
    heroFetcher,
    enabled: active,
    maxPerRow: MAX_PER_ROW,
    mapMetas: tmdbKey ? mapMetas : undefined,
  });

  useScrollMemory("kids", scrollRef, active);

  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);

  const restRows = useMemo(() => {
    const seen = new Set<string>();
    for (const m of hero) seen.add(m.id);
    return rows
      .map((r) => {
        const dedupedMetas = dropAdultContent(dropUnreleased(r.metas)).filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        return { ...r, metas: dedupedMetas };
      })
      .filter((r) => r.metas.length >= 4);
  }, [rows, hero]);

  return (
    <main ref={scrollCb} data-kids="on" className="relative h-full overflow-y-auto bg-canvas">
      <ScrollRootContext.Provider value={scrollEl}>
        <KidsHero featured={hero} />
        <div className="relative z-10 mt-[-14vh] flex w-full flex-col gap-6 px-12 pb-32 pt-3">
          <div aria-hidden className="kids-page-glow pointer-events-none absolute inset-0 -z-10" />
          <KidsDoodles />
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 bottom-0">
              <img
                src="/kids/doodles/lilleaflitter.png"
                alt=""
                draggable={false}
                className="absolute left-[2%] top-6 h-11 w-auto -rotate-12 opacity-90"
              />
              <img
                src="/kids/doodles/lilpurpocto.png"
                alt=""
                draggable={false}
                className="absolute left-[26%] top-9 h-12 w-auto opacity-90"
              />
              <img
                src="/kids/doodles/lilwhitestar.png"
                alt=""
                draggable={false}
                className="absolute left-[46%] top-3 h-6 w-auto opacity-80"
              />
              <img
                src="/kids/doodles/lilorangestar2.png"
                alt=""
                draggable={false}
                className="absolute left-[56%] top-11 h-9 w-auto opacity-90"
              />
              <img
                src="/kids/doodles/lilpurplestar.png"
                alt=""
                draggable={false}
                className="absolute left-[67%] top-4 h-14 w-auto opacity-85"
              />
            </div>
            <CatalogCustomizeBar
              editMode={pageRows.editMode}
              hasChanges={hasPageRowChanges(pageRows.custom)}
              onToggleEdit={() => pageRows.setEditMode((v) => !v)}
              onReset={() => pageRows.persist(resetPageRows())}
              kids
            />
          </div>
          {!settings.tmdbKey && <TmdbNudge />}
          <CatalogRows
            rows={restRows}
            editMode={pageRows.editMode}
            custom={pageRows.custom}
            onPersist={pageRows.persist}
            scrollPrefix="kids"
            onLoadMore={loadMore}
            kids
            injectAfter={2}
            injectNode={settings.tmdbKey ? <KidsFranchiseRail /> : undefined}
          />
        </div>
        <BackToTop scrollRef={scrollRef} />
      </ScrollRootContext.Provider>
    </main>
  );
}
