import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Play, Plus, TrendingUp } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import type { AnimeFilterOpts } from "@/lib/anime-filter";
import { fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import { SPECS, TOP_PICKS_KEY, EMPTY_ROW, type RowState } from "../anime/anime-rows";
import { buildHeroSelection, resolveHeroSlides, type HeroBuilt } from "../anime/hero-build";
import { MobileRail, MobileRankRail } from "./mobile-rail";
import { MobileDetail } from "./mobile-detail";
import { useMobileRemote } from "./mobile-remote";

const REDUCED =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function nameKey(name?: string): string {
  return name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
}

function dedupeMetas(metas: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    const k = nameKey(m.name);
    if (seen.has(m.id) || (k && seen.has(k))) continue;
    seen.add(m.id);
    if (k) seen.add(k);
    out.push(m);
  }
  return out;
}

function rankTitle(title: string): string {
  return `Top 10 ${title.replace(/^Top\s*/i, "")}`;
}

function initRows(): Record<string, RowState> {
  const init: Record<string, RowState> = {};
  for (const s of SPECS) init[s.key] = EMPTY_ROW;
  return init;
}

export function MobileAnime() {
  const { settings } = useSettings();
  const [rowsByKey, setRowsByKey] = useState<Record<string, RowState>>(initRows);
  const [anilistTrending, setAnilistTrending] = useState<Meta[]>([]);
  const [hero, setHero] = useState<HeroBuilt>({ metas: [], trending: {} });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const heroBuiltRef = useRef(false);
  const seedRef = useRef(Math.floor(Math.random() * 0x7fffffff));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    heroBuiltRef.current = false;
    setRowsByKey(initRows());
    setHero({ metas: [], trending: {} });
    (async () => {
      const BATCH = 6;
      let firstDone = false;
      for (let i = 0; i < SPECS.length; i += BATCH) {
        if (cancelled) return;
        await Promise.all(
          SPECS.slice(i, i + BATCH).map(async (s) => {
            try {
              const metas = await s.fetcher(1);
              if (!cancelled)
                setRowsByKey((p) => ({
                  ...p,
                  [s.key]: { metas, page: 1, hasMore: false, ready: true },
                }));
            } catch {
              if (!cancelled)
                setRowsByKey((p) => ({ ...p, [s.key]: { ...EMPTY_ROW, ready: true } }));
            }
          }),
        );
        if (!firstDone && !cancelled) {
          firstDone = true;
          setLoading(false);
        }
        if (i + BATCH < SPECS.length) await new Promise((r) => setTimeout(r, 350));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    fetchAnilistTrendingAnime(30)
      .then((m) => !cancelled && setAnilistTrending(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filterOpts = useMemo<AnimeFilterOpts>(
    () => ({
      excludeOrigins: settings.animeExcludeOrigins,
      hideWatched: settings.animeHideWatchedPicks,
    }),
    [settings.animeExcludeOrigins, settings.animeHideWatchedPicks],
  );

  useEffect(() => {
    if (heroBuiltRef.current) return;
    const ready = SPECS.filter((s) => rowsByKey[s.key]?.ready).length;
    if (ready < 2 && anilistTrending.length === 0) return;
    const built = buildHeroSelection(rowsByKey, seedRef.current, filterOpts, anilistTrending);
    if (built.metas.length < 3) return;
    heroBuiltRef.current = true;
    setHero(built);
    let cancelled = false;
    void resolveHeroSlides(settings.tmdbKey, built, filterOpts, (r) => {
      if (!cancelled && r.metas.length) setHero(r);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rowsByKey, anilistTrending, settings.tmdbKey, filterOpts]);

  const composed = useMemo(() => {
    const top10 = dedupeMetas(rowsByKey[TOP_PICKS_KEY]?.metas ?? []);
    const trend = dedupeMetas(anilistTrending);
    const base = new Set<string>();
    for (const m of hero.metas) base.add(nameKey(m.name));
    for (const m of top10) base.add(nameKey(m.name));
    const general = new Set(base);
    for (const m of trend) general.add(nameKey(m.name));
    const pools: Record<string, Set<string>> = {
      general,
      era: new Set(base),
      genre: new Set(base),
    };
    const rows: Array<{ key: string; title: string; metas: Meta[]; rank: boolean }> = [];
    for (const spec of SPECS) {
      if (spec.key === TOP_PICKS_KEY) continue;
      const row = rowsByKey[spec.key];
      if (!row?.ready) continue;
      const pool = pools[spec.pool ?? "general"];
      const metas: Meta[] = [];
      for (const m of dedupeMetas(row.metas)) {
        const k = nameKey(m.name);
        if (k && pool.has(k)) continue;
        if (k) pool.add(k);
        metas.push(m);
      }
      if (metas.length === 0) continue;
      const rank = !!spec.rank && metas.length >= 10;
      rows.push({
        key: spec.key,
        title: rank ? rankTitle(spec.title) : spec.title,
        metas: rank ? metas : metas.slice(0, 18),
        rank,
      });
    }
    return { top10, trend, rows };
  }, [rowsByKey, hero.metas, anilistTrending]);

  const anyRowData = useMemo(
    () => SPECS.some((s) => (rowsByKey[s.key]?.metas.length ?? 0) > 0),
    [rowsByKey],
  );

  if (loading && !anyRowData && hero.metas.length === 0) return <AnimeSkeleton />;
  if (!loading && !anyRowData && anilistTrending.length === 0 && hero.metas.length === 0) {
    return <FailedState onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const topSpec = SPECS.find((s) => s.key === TOP_PICKS_KEY);

  return (
    <div className="flex flex-col gap-7 motion-safe:[animation:harbor-step-in_420ms_var(--ease-out)_both]">
      {hero.metas.length > 0 ? (
        <AnimeHeroMobile
          slides={hero.metas}
          trending={hero.trending}
          onOpenDetail={setDetailMeta}
        />
      ) : (
        <HeroSkeleton />
      )}
      {composed.top10.length >= 6 && (
        <MobileRankRail
          title={rankTitle(topSpec?.title ?? "Airing")}
          metas={composed.top10}
          onOpenDetail={setDetailMeta}
        />
      )}
      {composed.trend.length > 0 && (
        <MobileRail
          title="Trending Anime"
          metas={composed.trend.slice(0, 18)}
          onOpenDetail={setDetailMeta}
        />
      )}
      {composed.rows.map((r) =>
        r.rank ? (
          <MobileRankRail
            key={r.key}
            title={r.title}
            metas={r.metas}
            onOpenDetail={setDetailMeta}
          />
        ) : (
          <MobileRail key={r.key} title={r.title} metas={r.metas} onOpenDetail={setDetailMeta} />
        ),
      )}
      <div className="h-4" />
      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function AnimeHeroMobile({
  slides,
  trending,
  onOpenDetail,
}: {
  slides: Meta[];
  trending: Record<string, string>;
  onOpenDetail: (m: Meta) => void;
}) {
  const { settings } = useSettings();
  const { playOnHost } = useMobileRemote();
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);
  const logos = useHeroLogos(slides, settings);
  const shown = useMemo(() => slides.slice(0, 6), [slides]);
  const current = shown[Math.min(active, Math.max(shown.length - 1, 0))];
  const inWl = useInWatchlist(current?.id ?? "", []);

  useEffect(() => {
    if (active >= shown.length && shown.length > 0) setActive(0);
  }, [shown.length, active]);

  useEffect(() => {
    if (REDUCED || shown.length < 2) return;
    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setActive((i) => (i + 1) % shown.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [shown.length]);

  if (shown.length === 0 || !current) return null;

  return (
    <section className="flex flex-col gap-3.5">
      <button
        type="button"
        aria-label={`Open ${current.name}`}
        onClick={() => onOpenDetail(current)}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-surface text-start"
      >
        {shown.map((m, i) => (
          <div
            key={m.id}
            aria-hidden={i !== active}
            className="absolute inset-0 motion-safe:transition-opacity motion-safe:duration-700 motion-safe:ease-out"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            <HeroArt
              meta={m}
              logo={logos[m.id] ?? m.logo}
              source={trending[m.id]}
              priority={i === 0}
            />
          </div>
        ))}
      </button>
      <div className="flex flex-col gap-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => playOnHost(current)}
            className="flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-full bg-ink text-[16px] font-semibold text-canvas shadow-[0_6px_20px_-6px_rgba(0,0,0,0.4)] transition-transform duration-150 active:scale-[0.97]"
          >
            <Play size={19} strokeWidth={0} fill="currentColor" />
            Play
          </button>
          <button
            type="button"
            aria-label={inWl ? "In My List" : "Add to My List"}
            onClick={() =>
              toggleWatchlist({
                id: current.id,
                type: current.type,
                name: current.name,
                poster: current.poster,
              })
            }
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-edge bg-canvas/55 text-ink transition-transform duration-150 active:scale-[0.94]"
          >
            {inWl ? (
              <Check size={20} strokeWidth={2.6} className="text-accent" />
            ) : (
              <Plus size={21} strokeWidth={2.2} />
            )}
          </button>
          <button
            type="button"
            aria-label="More info"
            onClick={() => onOpenDetail(current)}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-edge bg-canvas/55 text-ink transition-transform duration-150 active:scale-[0.94]"
          >
            <Info size={21} strokeWidth={2.2} />
          </button>
        </div>
        {shown.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {shown.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => {
                  setActive(i);
                  pausedUntil.current = Date.now() + 12000;
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-accent" : "w-1.5 bg-ink/25"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HeroArt({
  meta,
  logo,
  source,
  priority,
}: {
  meta: Meta;
  logo?: string;
  source?: string;
  priority?: boolean;
}) {
  const bg = meta.background || meta.poster;
  const year = (meta.releaseInfo ?? "").slice(0, 4);
  return (
    <>
      {bg && (
        <img
          src={bg}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "50% 18%" }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, var(--color-canvas) 2%, color-mix(in oklch, var(--color-canvas), transparent 45%) 26%, transparent 62%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 px-5 pb-5">
        {source && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">
            <TrendingUp size={12} strokeWidth={2.6} className="text-accent" />
            Trending on {source}
          </span>
        )}
        {logo ? (
          <img
            src={logo}
            alt={meta.name}
            className="max-h-[70px] max-w-[80%] object-contain object-left drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]"
          />
        ) : (
          <h2 className="font-display text-[32px] font-medium leading-[1.03] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
            {meta.name}
          </h2>
        )}
        <div className="flex items-center gap-3 text-[13px] text-white/85">
          {year && <span className="font-medium">{year}</span>}
          {meta.imdbRating && (
            <span className="flex items-center gap-1.5">
              <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
              <span className="font-semibold text-white">{meta.imdbRating}</span>
            </span>
          )}
          {meta.genres?.[0] && <span className="text-white/70">{meta.genres[0]}</span>}
        </div>
      </div>
    </>
  );
}

function Shimmer() {
  return (
    <span className="animate-shimmer pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-ink/[0.07] to-transparent motion-reduce:hidden" />
  );
}

function HeroSkeleton() {
  return (
    <section className="flex flex-col gap-3.5" aria-hidden>
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
        <Shimmer />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--color-canvas) 2%, transparent 60%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-5 pb-5">
          <div className="h-5 w-28 rounded-md bg-elevated/50" />
          <div className="h-8 w-2/3 rounded-lg bg-elevated/55" />
          <div className="h-3.5 w-2/5 rounded bg-elevated/40" />
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-4">
        <div className="h-[52px] flex-1 rounded-full bg-elevated/45" />
        <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/40" />
        <div className="h-[52px] w-[52px] shrink-0 rounded-full bg-elevated/40" />
      </div>
    </section>
  );
}

function RailSkeleton({ titleW }: { titleW: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className={`mx-4 h-[18px] ${titleW} rounded-md bg-elevated/45`} />
      <div className="flex gap-3 overflow-hidden px-4 pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="relative aspect-[2/3] w-[124px] shrink-0 overflow-hidden rounded-[14px] bg-elevated/40"
          >
            <Shimmer />
          </div>
        ))}
      </div>
    </section>
  );
}

function AnimeSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-hidden>
      <HeroSkeleton />
      <RailSkeleton titleW="w-44" />
      <RailSkeleton titleW="w-32" />
      <RailSkeleton titleW="w-40" />
    </div>
  );
}

function FailedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
      <h2 className="font-display text-[20px] font-medium text-ink">Couldn't load anime</h2>
      <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-muted">
        Harbor couldn't reach MyAnimeList or AniList. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-11 items-center rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-transform active:scale-95"
      >
        Try again
      </button>
    </div>
  );
}
