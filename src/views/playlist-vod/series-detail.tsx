import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import type { VodEpisode, VodSeries } from "@/lib/iptv/vod";
import { ArrowLeft, Play } from "lucide-react";
import { useState } from "react";

type Props = {
  series: VodSeries;
  onBack: () => void;
  onPlay: (ep: VodEpisode) => void;
};

export function SeriesDetail({ series, onBack, onPlay }: Props) {
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
          <h2 className="truncate text-[22px] font-semibold tracking-tight text-ink">{series.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {series.episodes.length === 1
              ? t("{n} episode", { n: 1 })
              : t("{n} episodes", { n: series.episodes.length })}
            {series.seasons.length > 1 ? ` · ${t("{n} seasons", { n: series.seasons.length })}` : ""}
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
                season === s ? "bg-ink text-canvas" : "bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {t("Season {n}", { n: s })}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {episodes.map((ep) => (
          <button
            key={`${ep.season}-${ep.episode}`}
            onClick={() => onPlay(ep)}
            className="group flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-elevated"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-[13px] font-semibold tabular-nums text-ink-muted group-hover:bg-raised group-hover:text-ink">
              {ep.episode}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{ep.title}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100">
              <Play size={15} fill="currentColor" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
