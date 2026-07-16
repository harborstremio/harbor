import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useTrakt } from "@/lib/trakt/provider";
import { aggregateWrapped } from "@/lib/wrapped/aggregate";
import { collectWatchEvents } from "@/lib/wrapped/collect";
import { enrichTopTitles } from "@/lib/wrapped/enrich";
import type { WrappedStats } from "@/lib/wrapped/types";
import {
  GenresCard,
  HeatmapCard,
  HeroCard,
  SplitCard,
  TopTitlesCard,
  WrappedEmpty,
} from "./wrapped/cards";

export function WrappedView({ active }: { active: boolean }) {
  const t = useT();
  const { settings } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!active || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const { events, source } = await collectWatchEvents({ traktConnected });
        const year = new Date().getFullYear();
        const yearStats = aggregateWrapped(events, source, year);
        const resolved =
          yearStats.totalPlays === 0 && events.length > 0
            ? aggregateWrapped(events, source, null)
            : yearStats;
        if (cancelled) return;
        setStats(resolved);
        if (resolved.source !== "empty" && resolved.topTitles.length > 0) {
          void enrichTopTitles(resolved.topTitles, settings.tmdbKey).then(({ genres, posters }) => {
            if (cancelled) return;
            setStats((prev) =>
              prev
                ? { ...prev, topGenres: genres.length > 0 ? genres : prev.topGenres, posters }
                : prev,
            );
          });
        }
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, traktConnected]);

  return (
    <main data-tv-content-zone className="h-full w-full overflow-y-auto bg-canvas px-5 pb-28 pt-24 sm:px-8 lg:px-12 lg:pt-28">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
            {t("My library")}
          </span>
          <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight text-ink">
            {t("Stats")}
          </h1>
        </div>
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-elevated/40" />
            ))}
          </div>
        ) : !stats || stats.source === "empty" ? (
          <WrappedEmpty />
        ) : (
          <>
            <HeroCard stats={stats} />
            <SplitCard stats={stats} />
            <TopTitlesCard stats={stats} />
            <GenresCard stats={stats} />
            <HeatmapCard stats={stats} />
          </>
        )}
      </div>
    </main>
  );
}
