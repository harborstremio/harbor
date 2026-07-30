import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { VodEpisode, VodSeries } from "@/lib/iptv/vod";
import { EpisodeRow } from "./episode-row";

type Props = {
  series: VodSeries;
  loading?: boolean;
  onBack: () => void;
  onPlay: (ep: VodEpisode) => void;
};

export function SeriesDetail({ series, loading = false, onBack, onPlay }: Props) {
  const t = useT();
  const [season, setSeason] = useState<number>(series.seasons[0] ?? 1);
  const episodes = series.episodes.filter((e) => e.season === season);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          aria-label={t("Back to library")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-edge-soft/55 bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink"
        >
          <ArrowLeft size={18} strokeWidth={2} className="dir-icon" />
        </button>
        <div className="w-20 shrink-0">
          <Poster src={series.logo ?? undefined} seed={series.title} className="w-full" />
        </div>
        <div className="min-w-0 pt-1">
          <h2 className="truncate text-[22px] font-semibold tracking-tight text-ink">
            {series.title}
          </h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {loading
              ? t("Loading episodes...")
              : series.episodes.length === 1
                ? t("{n} episode", { n: 1 })
                : t("{n} episodes", { n: series.episodes.length })}
            {series.seasons.length > 1
              ? ` · ${t("{n} seasons", { n: series.seasons.length })}`
              : ""}
            {series.group ? ` · ${series.group}` : ""}
          </p>
        </div>
      </div>

      {series.seasons.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {series.seasons.map((s) => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-colors ${
                season === s
                  ? "bg-ink text-canvas"
                  : "bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {t("Season {n}", { n: s })}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {loading ? (
          <p className="px-3 py-4 text-[14px] text-ink-muted">{t("Loading episodes...")}</p>
        ) : (
          episodes.map((ep) => (
            <EpisodeRow
              key={`${ep.season}-${ep.episode}`}
              seriesId={series.id}
              ep={ep}
              fallbackLogo={series.logo}
              onPlay={() => onPlay(ep)}
            />
          ))
        )}
      </div>
    </div>
  );
}
