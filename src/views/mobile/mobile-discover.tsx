import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useHideAnimeMetas, useHideAnimeRows } from "@/lib/anime-hide";
import { getStore } from "@/lib/discover/store";
import { fetchCriticsPickList, selectDailyRows } from "@/lib/feed";
import { buildFeatured, buildFeaturedFast } from "@/lib/feed/featured";
import { ANCHOR_TRENDING } from "@/lib/feed/daily-rows-anchors";
import { MobileRail, MobileRankRail } from "./mobile-rail";
import { MobileDetail } from "./mobile-detail";
import { MobileFeatured } from "./mobile-featured";

type Row = { id: string; title: string; metas: Meta[] };
type DiscoverResult = {
  settings: ReturnType<typeof useSettings>["settings"];
  reloadKey: number;
  featured: Meta[];
  rawRows: Row[];
  loading: boolean;
  failed: boolean;
};

const ROW_CAP = 18;
const NO_METAS: Meta[] = [];
const NO_ROWS: Row[] = [];

function nameKey(m: Meta): string {
  return m.name ? m.name.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
}

function dedupeRows(rows: Row[], featured: Meta[]): Row[] {
  const seen = new Set<string>();
  for (const m of featured) {
    seen.add(m.id);
    const nk = nameKey(m);
    if (nk) seen.add(nk);
  }
  const out: Row[] = [];
  for (const r of rows) {
    const metas: Meta[] = [];
    for (const m of r.metas) {
      if (metas.length >= ROW_CAP) break;
      const nk = nameKey(m);
      if (seen.has(m.id) || (nk && seen.has(nk))) continue;
      seen.add(m.id);
      if (nk) seen.add(nk);
      metas.push(m);
    }
    if (metas.length > 0) out.push({ id: r.id, title: r.title, metas });
  }
  return out;
}

export function MobileDiscover() {
  const { settings } = useSettings();
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const key = settings.tmdbKey;
  const matchesRequest = result?.settings === settings && result.reloadKey === reloadKey;
  const featured = matchesRequest ? result.featured : NO_METAS;
  const rawRows = matchesRequest ? result.rawRows : NO_ROWS;
  const loading = !matchesRequest || result.loading;
  const failed = matchesRequest && result.failed;

  useEffect(() => {
    let alive = true;
    const update = (fn: (current: DiscoverResult) => DiscoverResult) => {
      if (!alive) return;
      setResult((current) =>
        fn(
          current?.settings === settings && current.reloadKey === reloadKey
            ? current
            : {
                settings,
                reloadKey,
                featured: [],
                rawRows: [],
                loading: true,
                failed: false,
              },
        ),
      );
    };

    if (key) {
      buildFeaturedFast(key, settings)
        .then((r) => {
          if (r.featured.length) {
            update((current) => ({
              ...current,
              featured: current.featured.length ? current.featured : r.featured,
            }));
          }
        })
        .catch(() => {});
    }
    buildFeatured(key, settings)
      .then((r) => {
        if (r.featured.length) {
          update((current) => ({ ...current, featured: r.featured }));
        }
      })
      .catch(() => {});

    (async () => {
      try {
        const defs = selectDailyRows(key, getStore().affinity, settings, 14);
        const [settled, critics] = await Promise.all([
          Promise.all(
            defs.map((d) =>
              d
                .fetch(1)
                .then((metas) => ({ id: d.id, title: d.shelf.title, metas }))
                .catch(() => ({ id: d.id, title: d.shelf.title, metas: [] as Meta[] })),
            ),
          ),
          fetchCriticsPickList(key, settings).catch(() => [] as Meta[]),
        ]);
        if (!alive) return;
        const rows: Row[] = settled.filter((r) => r.metas.length > 0);
        if (critics.length > 0) {
          rows.splice(Math.min(3, rows.length), 0, {
            id: "critics_pick",
            title: "Critics' Picks",
            metas: critics,
          });
        }
        update((current) => ({
          ...current,
          rawRows: rows,
          failed: rows.length === 0,
          loading: false,
        }));
      } catch {
        update((current) => ({ ...current, failed: true, loading: false }));
      }
    })();

    return () => {
      alive = false;
    };
  }, [key, settings, reloadKey]);

  const rows = useMemo(() => dedupeRows(rawRows, featured), [rawRows, featured]);
  const shownRows = useHideAnimeRows(rows);
  const shownFeatured = useHideAnimeMetas(featured);

  if (loading && rawRows.length === 0 && featured.length === 0) {
    return <DiscoverSkeleton />;
  }

  if (failed && rawRows.length === 0 && featured.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
        <h2 className="font-display text-[20px] font-medium text-ink">Couldn't load Discover</h2>
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
      <MobileFeatured items={shownFeatured} onOpen={setDetailMeta} />
      {shownRows.map((r, i) =>
        i === 0 && r.id.split(":")[0] === ANCHOR_TRENDING && r.metas.length >= 6 ? (
          <MobileRankRail key={r.id} title={r.title} metas={r.metas} onOpenDetail={setDetailMeta} />
        ) : (
          <MobileRail key={r.id} title={r.title} metas={r.metas} onOpenDetail={setDetailMeta} />
        ),
      )}
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

function DiscoverSkeleton() {
  return (
    <div className="flex flex-col gap-7 pt-3" aria-hidden>
      <section className="flex flex-col gap-4">
        <div className="px-4">
          <div className="h-6 w-56 rounded-md bg-elevated/50" />
        </div>
        <div className="px-4">
          <div className="relative aspect-[4/5] w-[86%] overflow-hidden rounded-[22px] bg-surface ring-1 ring-edge-soft/50">
            <Shimmer />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5">
              <div className="h-7 w-3/5 rounded-lg bg-elevated/55" />
              <div className="h-3.5 w-2/5 rounded bg-elevated/40" />
              <div className="h-3 w-4/5 rounded bg-elevated/35" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-ink/20" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink/12" />
          <span className="h-1.5 w-1.5 rounded-full bg-ink/12" />
        </div>
      </section>
      <RailSkeleton titleW="w-40" />
      <RailSkeleton titleW="w-28" />
      <RailSkeleton titleW="w-36" />
    </div>
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
