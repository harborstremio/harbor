import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CatalogRows } from "@/components/catalog/catalog-rows";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { ScrollRootContext } from "@/components/row";
import { TmdbNudge } from "@/components/nudge";
import { topMovies, type Meta } from "@/lib/cinemeta";
import { recentlyPlayed } from "@/lib/playback-history";
import { listPager } from "@/lib/list-pager";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { KidsDoodles } from "./kids/kids-doodles";
import { dropUnreleased, dropUnsafeCinemetaKids, dropUnsafeGenres } from "./kids/kids-filter";
import { KidsFranchiseRail } from "./kids/kids-franchise-rail";
import { KidsHero } from "./kids/kids-hero";
import { KidsPlayZone } from "./kids/play/play-zone";
import { buildKidsHero, kidsSpecs } from "./kids/kids-specs";

const MAX_PER_ROW = 120;

type KidsRow = {
  key: string;
  title: string;
  metas: Meta[];
  page: number;
  hasMore: boolean;
  fetcher?: (page: number) => Promise<Meta[]>;
};

export function Kids({ active = true }: { active?: boolean }) {
  const { settings } = useSettings();
  const pageRows = usePageRows("kids");
  const [hero, setHero] = useState<Meta[]>([]);
  const [rows, setRows] = useState<KidsRow[]>([]);
  const [playOpen, setPlayOpen] = useState(false);
  const rowsRef = useRef<KidsRow[]>([]);
  const loadingRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useScrollMemory("kids", scrollRef, active);

  useEffect(() => {
    const openPlay = () => setPlayOpen(true);
    window.addEventListener("harbor:kids-play", openPlay);
    return () => {
      window.removeEventListener("harbor:kids-play", openPlay);
    };
  }, []);

  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = recentlyPlayed();
      if (settings.tmdbKey) {
        const heroPool = await buildKidsHero(settings.tmdbKey, seen).catch(() => [] as Meta[]);
        if (cancelled) return;
        setHero(dropUnsafeGenres(dropUnreleased(heroPool)));
        const specs = kidsSpecs(settings.tmdbKey);
        const firstPages = await Promise.all(
          specs.map((s) => s.fetcher(1).catch(() => [] as Meta[])),
        );
        if (cancelled) return;
        const built: KidsRow[] = specs
          .map((spec, i) => ({
            key: spec.key,
            title: spec.title,
            metas: firstPages[i],
            page: 1,
            hasMore: firstPages[i].length >= 14,
            fetcher: spec.fetcher,
          }))
          .filter((r) => r.metas.length > 0);
        setRows(built);
      } else {
        const [animation, family] = await Promise.all(
          ["Animation", "Family"].map((genre) =>
            topMovies(genre)
              .then(dropUnreleased)
              .then(dropUnsafeCinemetaKids)
              .catch(() => [] as Meta[]),
          ),
        );
        if (cancelled) return;
        setHero(animation.filter((m) => m.background).slice(0, 5));
        setRows(
          [
            { key: "cinemeta-animation", title: "Animated Movies", metas: animation },
            { key: "cinemeta-family", title: "Family Movies", metas: family },
          ].map((row) => ({
            ...row,
            page: 1,
            hasMore: false,
            fetcher: listPager(row.metas),
          })),
        );
      }
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

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

  const restRows = useMemo(() => {
    const seen = new Set<string>();
    for (const m of hero) seen.add(m.id);
    return rows
      .map((r) => {
        const dedupedMetas = dropUnsafeGenres(dropUnreleased(r.metas)).filter((m) => {
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
        <div className="relative z-10 -mt-[14vh] flex w-full flex-col gap-6 px-12 pb-32 pt-3">
          <div aria-hidden className="kids-page-glow pointer-events-none absolute inset-0 -z-10" />
          <KidsDoodles />
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 bottom-0">
              <img src="/kids/doodles/lilleaflitter.png" alt="" draggable={false} className="absolute left-[2%] top-6 h-11 w-auto -rotate-12 opacity-90" />
              <img src="/kids/doodles/lilpurpocto.png" alt="" draggable={false} className="absolute left-[26%] top-9 h-12 w-auto opacity-90" />
              <img src="/kids/doodles/lilwhitestar.png" alt="" draggable={false} className="absolute left-[46%] top-3 h-6 w-auto opacity-80" />
              <img src="/kids/doodles/lilorangestar2.png" alt="" draggable={false} className="absolute left-[56%] top-11 h-9 w-auto opacity-90" />
              <img src="/kids/doodles/lilpurplestar.png" alt="" draggable={false} className="absolute left-[67%] top-4 h-14 w-auto opacity-85" />
            </div>
            <CatalogCustomizeBar
              editMode={pageRows.editMode}
              hasChanges={hasPageRowChanges(pageRows.custom)}
              onToggleEdit={() => pageRows.setEditMode((v) => !v)}
              onReset={() => pageRows.persist(resetPageRows())}
              kids
            />
          </div>
          <button
            type="button"
            onClick={() => setPlayOpen(true)}
            className="group relative flex items-center gap-6 overflow-hidden rounded-2xl border-4 border-white/40 px-8 py-6 text-start shadow-[0_24px_60px_-24px_rgba(6,44,71,0.55)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "linear-gradient(115deg, #1a7d9e 0%, #10618a 55%, #0a4062 100%)",
            }}
          >
            <span aria-hidden className="kids-sparkles opacity-50" />
            <img
              src="/kids/doodles/lilbluewhale.png"
              alt=""
              draggable={false}
              className="h-20 w-auto shrink-0 transition-transform duration-300 group-hover:scale-110"
              style={{ animation: "curfew-sail 4.5s ease-in-out infinite" }}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-[30px] font-medium leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,20,40,0.45)]">
                Play Zone
              </span>
              <span className="text-[15.5px] font-semibold text-white/80">
                Games, puzzles and amazing ocean facts. Dive in!
              </span>
            </span>
            <img
              src="/kids/doodles/lilpurpocto.png"
              alt=""
              draggable={false}
              className="hidden h-16 w-auto shrink-0 sm:block"
              style={{ animation: "kids-drift 8s ease-in-out infinite" }}
            />
            <span className="flex h-14 shrink-0 items-center rounded-full bg-[#ffd166] px-7 text-[17px] font-bold text-[#4a3200] transition-transform duration-150 group-hover:scale-105">
              Let's play!
            </span>
          </button>
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
          <img
            src="/kids/octofooter.svg"
            alt=""
            draggable={false}
            className="pointer-events-none absolute bottom-0 end-0 w-[clamp(150px,18vw,280px)] opacity-95"
          />
        </div>
        <BackToTop scrollRef={scrollRef} />
        {playOpen && <KidsPlayZone onClose={() => setPlayOpen(false)} />}
      </ScrollRootContext.Provider>
    </main>
  );
}
