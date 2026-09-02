import { useState } from "react";
import { Check, ChevronDown, Hourglass, RotateCcw } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { EpisodeRatingBadge } from "@/views/detail/episode-rating-badge";
import { useT } from "@/lib/i18n";

function formatAirDate(d: string): string {
  const date = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function EpisodeRow({
  episode,
  expanded,
  onToggle,
  onPlay,
  isCurrent = false,
  watched = false,
  spoiler,
  imdbRating,
}: {
  episode: PlayEpisode;
  expanded: boolean;
  onToggle: () => void;
  onPlay: () => void;
  isCurrent?: boolean;
  watched?: boolean;
  spoiler?: SpoilerMask;
  imdbRating?: number;
}) {
  const t = useT();
  const { settings } = useSettings();
  const imdbVal = imdbRating != null && imdbRating > 0 ? imdbRating : null;
  const tmdbVal = episode.rating != null && episode.rating > 0 ? episode.rating : null;
  const ratingVal = imdbVal ?? tmdbVal;
  const hasMeta = !!episode.airDate || episode.runtime != null;
  const epLabel = `S${episode.imdbSeason ?? episode.season} · E${String(episode.imdbEpisode ?? episode.episode).padStart(2, "0")}`;
  const hasStill = !!episode.still;
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div
      className={`group overflow-hidden rounded-2xl bg-elevated/60 ring-1 ${
        isCurrent ? "ring-2 ring-accent" : "ring-edge-soft"
      }`}
    >
      <div className="flex gap-4 p-3">
        <div className="relative aspect-video h-[88px] shrink-0 overflow-hidden rounded-xl bg-canvas/60 ring-1 ring-edge-soft/60">
          {hasStill && !imgFailed && (
            <div className={`h-full w-full overflow-hidden ${spoiler?.thumb ? SPOILER_THUMB_CLASS : ""}`}>
              <img
                src={episode.still}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          {(!hasStill || imgFailed) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-elevated/50 to-canvas/70">
              <Hourglass size={18} strokeWidth={1.8} className="text-ink-subtle/45" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="absolute bottom-1.5 start-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
            {epLabel}
          </span>
          {settings.showEpisodeRating && ratingVal != null && (
            <span className="absolute bottom-1.5 end-1.5 flex items-center gap-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              <EpisodeRatingBadge value={ratingVal} isImdb={imdbVal != null} />
            </span>
          )}
          {watched && !isCurrent && (
            <span
              title={t("Watched")}
              className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-emerald-400 ring-1 ring-white/15 backdrop-blur-sm"
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className={`line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}>
              {episode.name ?? t("Episode {n}", { n: episode.episode })}
            </p>
            {isCurrent && (
              <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/30">
                {t("Now Playing")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPlay}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_82%,var(--color-canvas))] px-4 text-[14px] font-semibold text-canvas transition-[background-color] hover:bg-[color-mix(in_srgb,var(--color-accent)_92%,var(--color-canvas))]"
            >
              {isCurrent ? <RotateCcw size={15} strokeWidth={2.6} /> : <Play size={16} fill="currentColor" />}
              {isCurrent ? t("Restart") : t("Play")}
            </button>
            <button
              onClick={onToggle}
              aria-label={expanded ? t("Hide details") : t("Show details")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
      <div
        className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`mx-3 mb-3 flex flex-col gap-2 rounded-xl bg-canvas/40 p-3 transition-opacity duration-200 ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            {hasMeta && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-subtle">
                {episode.airDate && <span>{formatAirDate(episode.airDate)}</span>}
                {episode.runtime != null && <span>{t("{n} min", { n: episode.runtime })}</span>}
              </div>
            )}
            {episode.overview ? (
              <p className={`text-[13px] leading-relaxed text-ink-muted ${spoiler?.desc ? SPOILER_TEXT_CLASS : ""}`}>
                {episode.overview}
              </p>
            ) : (
              <p className="text-[12.5px] text-ink-subtle">{t("No description available.")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
