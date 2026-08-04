import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { buildCinemetaRows, buildTmdbRows } from "@/views/home/home-rows";
import { useSettings } from "@/lib/settings";
import { useHideAnimeMetas, useHideAnimeRows } from "@/lib/anime-hide";
import { MobileHero } from "./mobile-hero";
import { MobileCwRow, useMobileCw } from "./mobile-cw-row";
import { MobileRail, MobileRankRail } from "./mobile-rail";
import { MobileDetail } from "./mobile-detail";

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

type HomeResult = {
  settings: ReturnType<typeof useSettings>["settings"];
  reloadKey: number;
  hero: Meta[];
  rows: HomeRow[];
  loading: boolean;
  failed: boolean;
};

export function MobileHome() {
  const { settings } = useSettings();
  const [result, setResult] = useState<HomeResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const cw = useMobileCw(14);
  const matchesRequest = result?.settings === settings && result.reloadKey === reloadKey;
  const hero = result?.hero ?? [];
  const rows = result?.rows ?? [];
  const loading = !matchesRequest || result.loading;
  const failed = matchesRequest && result.failed;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const built = settings.tmdbKey ? await buildTmdbRows(settings) : await buildCinemetaRows();
        if (!alive) return;
        let heroPool = built.hero;
        let rowList = built.rows;
        if (rowList.length === 0) {
          const fb = await buildCinemetaRows();
          if (!alive) return;
          heroPool = fb.hero;
          rowList = fb.rows;
        }
        setResult({
          settings,
          reloadKey,
          hero: dedupeMetas(heroPool.filter((m) => m.background)).slice(0, 8),
          rows: rowList,
          failed: rowList.length === 0,
          loading: false,
        });
      } catch {
        if (alive) {
          setResult((current) => ({
            settings,
            reloadKey,
            hero: current?.hero ?? [],
            rows: current?.rows ?? [],
            failed: true,
            loading: false,
          }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [settings, reloadKey]);

  const shownHero = useHideAnimeMetas(hero);
  const shownRows = useHideAnimeRows(rows);

  if (loading && rows.length === 0) {
    return <HomeSkeleton />;
  }

  if (failed && rows.length === 0 && cw.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h2 className="font-display text-[20px] font-medium text-ink">Couldn't load your home</h2>
        <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-muted">
          Harbor couldn't reach the catalog servers. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform active:scale-95"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 pt-3 motion-safe:[animation:harbor-step-in_420ms_var(--ease-out)_both]">
      <MobileHero slides={shownHero} onOpenDetail={setDetailMeta} />
      {cw.length > 0 && <MobileCwRow items={cw} onOpenDetail={setDetailMeta} />}
      {shownRows[0] && shownRows[0].metas.length >= 6 && (
        <MobileRankRail
          title="Top 10 Today"
          metas={dedupeMetas(shownRows[0].metas)}
          onOpenDetail={setDetailMeta}
        />
      )}
      {shownRows.slice(1).map((r) => (
        <MobileRail
          key={r.key}
          title={r.name}
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

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-7 pt-3" aria-hidden>
      <HeroSkeleton />
      <RailSkeleton titleW="w-40" />
      <RailSkeleton titleW="w-28" />
      <RailSkeleton titleW="w-36" />
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="px-4">
        <div className="relative aspect-[16/13] w-full overflow-hidden rounded-[24px] bg-surface ring-1 ring-edge-soft/50">
          <Shimmer />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
            <div className="h-5 w-28 rounded-md bg-elevated/50" />
            <div className="h-7 w-2/3 rounded-lg bg-elevated/55" />
            <div className="h-3.5 w-2/5 rounded bg-elevated/40" />
            <div className="mt-1 flex items-center gap-2.5">
              <div className="h-[52px] w-[132px] rounded-full bg-elevated/50" />
              <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/45" />
              <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/45" />
            </div>
          </div>
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
            <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] bg-elevated/40">
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
