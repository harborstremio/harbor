import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { topSeries } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useHideAnimeMetas, useHideAnimeRows } from "@/lib/anime-hide";
import { buildShowHero } from "@/views/shows/hero-curation";
import { showSpecs } from "@/views/shows/show-specs";
import { MobileHero } from "./mobile-hero";
import { MobileRail, MobileRankRail } from "./mobile-rail";
import { MobileDetail } from "./mobile-detail";

type RowData = { key: string; title: string; metas: Meta[] };

const GENRES = [
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

function dedupeMetas(metas: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    const nameKey = m.name ? m.name.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
    if (seen.has(m.id) || (nameKey && seen.has(nameKey))) continue;
    seen.add(m.id);
    if (nameKey) seen.add(nameKey);
    out.push(m);
  }
  return out;
}

export function MobileShows() {
  const t = useT();
  const { settings } = useSettings();
  const [hero, setHero] = useState<Meta[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        let heroPool: Meta[] = [];
        let rowList: RowData[] = [];
        if (settings.tmdbKey) {
          const key = settings.tmdbKey;
          const built = await buildShowHero(key).catch(() => [] as Meta[]);
          const specs = showSpecs(key);
          const pages = await Promise.all(specs.map((s) => s.fetcher(1).catch(() => [] as Meta[])));
          if (!alive) return;
          const tmdbRows = specs
            .map((spec, i) => ({ key: spec.key, title: spec.title, metas: pages[i] }))
            .filter((r) => r.metas.length > 0);
          if (tmdbRows.length > 0) {
            heroPool = built;
            rowList = tmdbRows;
          }
        }
        if (rowList.length === 0) {
          const [top, ...byGenre] = await Promise.all([
            topSeries().catch(() => [] as Meta[]),
            ...GENRES.map((g) => topSeries(g).catch(() => [] as Meta[])),
          ]);
          if (!alive) return;
          heroPool = top;
          rowList = [{ key: "cinemeta-top", title: "Top Series", metas: top }];
          for (let i = 0; i < GENRES.length; i++) {
            const list = byGenre[i] ?? [];
            if (list.length === 0) continue;
            rowList.push({
              key: `cinemeta-${GENRES[i].toLowerCase().replace(/[^a-z]/g, "")}`,
              title: `Top ${GENRES[i]}`,
              metas: list,
            });
          }
        }
        setHero(dedupeMetas(heroPool.filter((m) => m.background)).slice(0, 8));
        setRows(rowList);
        setFailed(rowList.length === 0);
      } catch {
        if (alive) setFailed(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [settings.tmdbKey, reloadKey]);

  const shownRows = useHideAnimeRows(rows);
  const shownHero = useHideAnimeMetas(hero);

  if (loading && rows.length === 0) {
    return <ShowsSkeleton />;
  }

  if (failed && rows.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h2 className="font-display text-[20px] font-medium text-ink">
          {t("Couldn't load shows")}
        </h2>
        <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-muted">
          {t("Harbor couldn't reach the catalog servers. Check your connection and try again.")}
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform active:scale-95"
        >
          {t("Try again")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 pt-3 motion-safe:[animation:harbor-step-in_420ms_var(--ease-out)_both]">
      <MobileHero slides={shownHero} onOpenDetail={setDetailMeta} />
      {shownRows[0] && shownRows[0].metas.length >= 6 && (
        <MobileRankRail
          title={t("Top 10 Series Today")}
          metas={dedupeMetas(shownRows[0].metas)}
          onOpenDetail={setDetailMeta}
        />
      )}
      {shownRows.slice(1).map((r) => (
        <MobileRail
          key={r.key}
          title={t(r.title)}
          metas={dedupeMetas(r.metas).slice(0, 18)}
          onOpenDetail={setDetailMeta}
        />
      ))}
      <div className="h-4" />
      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function Shimmer() {
  return (
    <span className="animate-shimmer pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-ink/[0.07] to-transparent motion-reduce:hidden" />
  );
}

function ShowsSkeleton() {
  return (
    <div className="flex flex-col gap-7 pt-3" aria-hidden>
      <HeroSkeleton />
      <RailSkeleton titleW="w-44" />
      <RailSkeleton titleW="w-28" />
      <RailSkeleton titleW="w-36" />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <div className="relative aspect-[16/11] w-full overflow-hidden rounded-3xl bg-surface ring-1 ring-edge-soft/50">
          <Shimmer />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
            <div className="h-5 w-28 rounded-md bg-elevated/50" />
            <div className="h-7 w-2/3 rounded-lg bg-elevated/55" />
            <div className="h-3.5 w-2/5 rounded bg-elevated/40" />
          </div>
        </div>
        <div className="mt-3.5 flex items-center gap-2.5">
          <div className="h-[52px] w-[132px] rounded-full bg-elevated/45" />
          <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/40" />
          <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/40" />
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <span className="h-1.5 w-5 rounded-full bg-ink/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink/12" />
        <span className="h-1.5 w-1.5 rounded-full bg-ink/12" />
      </div>
    </section>
  );
}

function RailSkeleton({ titleW }: { titleW: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <div className={`h-[18px] ${titleW} rounded-md bg-elevated/45`} />
      </div>
      <div className="flex gap-3 overflow-hidden px-4 pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[124px] shrink-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-elevated/40">
              <Shimmer />
            </div>
            <div className="mt-1.5 h-2.5 w-4/5 rounded bg-elevated/35" />
            <div className="mt-1.5 h-2.5 w-3/5 rounded bg-elevated/30" />
          </div>
        ))}
      </div>
    </section>
  );
}
