import { CalendarDays, Check, Info, Play, RotateCcw } from "lucide-react";
import { EpisodeDownloadButton } from "./episode-download-button";
import { useEffect, useRef, useState } from "react";
import { EpisodeRatingBadge } from "./episode-rating-badge";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { prefetchSegments } from "@/lib/skip-intro";
import { formatAirDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { FillerBadge, UpcomingBadge } from "./badges";
import type { GridEpisode, Progress } from "./episode-grid-types";

const HOVER_DELAY = 220;

type T = ReturnType<typeof useT>;

export function EpisodeGridCard({
  meta,
  g,
  progress,
  spoiler,
  onContextMenu,
}: {
  meta: Meta;
  g: GridEpisode;
  progress: Progress;
  spoiler?: SpoilerMask;
  onContextMenu?: (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const cardMeta = g.meta ?? meta;
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => setImgIdx(0), [g.key]);
  const [preview, setPreview] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const still = g.stills[imgIdx];
  const watched = progress.watched;
  const partial = !watched && progress.ratio > 0.01;
  const minsLeft =
    partial && g.runtime ? Math.max(1, Math.round(g.runtime * (1 - progress.ratio))) : 0;
  const spoilered = !!spoiler && (spoiler.thumb || spoiler.title || spoiler.desc);

  const enter = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreview(true), HOVER_DELAY);
    prefetchSegments(cardMeta, { season: g.season, episode: g.number });
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    setPreview(false);
  };
  const ctx = (e: React.MouseEvent) =>
    onContextMenu?.(e, g.season, g.number, watched, g.sourceMetaId);

  const thumbDim = spoiler?.thumb
    ? SPOILER_THUMB_CLASS
    : g.upcoming
      ? "opacity-55 saturate-50"
      : watched
        ? "opacity-45 transition-opacity duration-200 group-hover:opacity-75"
        : "";

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`group relative ${preview ? "z-30" : ""}`}
    >
      <button
        data-ep={g.number}
        data-no-card-ring
        onClick={() => g.play({ resume: partial })}
        onContextMenu={ctx}
        onFocus={() => prefetchSegments(cardMeta, { season: g.season, episode: g.number })}
        className="flex w-full flex-col gap-2.5 text-start"
      >
        <div className="relative aspect-video overflow-hidden rounded-xl">
          <div className={thumbDim}>
            <Poster
              src={still}
              seed={g.key}
              ratio="landscape"
              lazy
              onError={() => setImgIdx((i) => i + 1)}
            />
          </div>
          <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {g.number}
          </span>
          {g.upcoming && (
            <span className="absolute bottom-2 start-2">
              <UpcomingBadge />
            </span>
          )}
          <StatusTag watched={watched} minsLeft={minsLeft} runtime={g.runtime} t={t} />
          {settings.showEpisodeRating && g.rating && g.rating > 0 && (
            <div className="pointer-events-none absolute bottom-2 start-2 z-[5] flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 drop-shadow-md backdrop-blur-sm">
              <EpisodeRatingBadge value={g.rating} isImdb={!!g.ratingIsImdb} />
            </div>
          )}
          {partial && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.max(2, progress.ratio * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-0.5">
          <span className="flex items-center gap-1.5">
            <span
              className={`line-clamp-2 text-[13.5px] font-semibold text-ink ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}
            >
              {g.title}
            </span>
            {g.filler && <FillerBadge />}
          </span>
          <span className="text-[11.5px] text-ink-subtle">
            {g.seasonLabel ? `${g.seasonLabel} · E${g.number}` : `E${g.number}`}
            {g.runtime ? ` · ${t("{n} min", { n: g.runtime })}` : ""}
          </span>
          {settings.showEpisodeDescription && g.overview && (
            <p
              className={`mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-muted ${spoiler?.desc ? SPOILER_TEXT_CLASS : ""}`}
            >
              {g.overview}
            </p>
          )}
        </div>
      </button>
      {preview && !spoilered && (
        <EpisodePreview
          meta={cardMeta}
          g={g}
          still={still}
          watched={watched}
          minsLeft={minsLeft}
          ratio={progress.ratio}
          onContext={ctx}
          t={t}
        />
      )}
    </div>
  );
}

function StatusTag({
  watched,
  minsLeft,
  runtime,
  t,
}: {
  watched: boolean;
  minsLeft: number;
  runtime: number | null;
  t: T;
}) {
  if (watched)
    return (
      <span className="absolute bottom-2 end-2 flex items-center gap-1 rounded-md bg-canvas/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-300">
        <Check size={11} strokeWidth={3} />
        {t("Watched")}
      </span>
    );
  if (minsLeft > 0)
    return (
      <span className="absolute bottom-2 end-2 rounded-md bg-canvas/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
        {t("{n}m left", { n: minsLeft })}
      </span>
    );
  if (runtime)
    return (
      <span className="absolute bottom-2 end-2 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">
        {t("{n}m", { n: runtime })}
      </span>
    );
  return null;
}

function EpisodePreview({
  meta,
  g,
  still,
  watched,
  minsLeft,
  ratio,
  onContext,
  t,
}: {
  meta: Meta;
  g: GridEpisode;
  still?: string;
  watched: boolean;
  minsLeft: number;
  ratio: number;
  onContext: (e: React.MouseEvent) => void;
  t: T;
}) {
  const { openEpisodeDetail } = useView();
  return (
    <div className="animate-popover-in absolute -inset-x-2 -top-2 z-30 overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)]">
      <button
        onClick={() => g.play({ resume: !watched && ratio > 0.01 })}
        onContextMenu={onContext}
        className="block w-full text-start"
      >
        <div className="relative aspect-video overflow-hidden">
          <Poster src={still} seed={g.key} ratio="landscape" />
          {watched && <div className="absolute inset-0 bg-canvas/45" />}
          <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {g.number}
          </span>
          {minsLeft > 0 && (
            <>
              <span className="absolute bottom-2 end-2 rounded-md bg-canvas/90 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
                {t("{n}m left", { n: minsLeft })}
              </span>
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.max(2, ratio * 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      </button>
      <div className="flex flex-col gap-1.5 p-3.5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          {meta.name}
        </span>
        <h4 className="line-clamp-1 text-[14px] font-semibold leading-snug text-ink">{g.title}</h4>
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
          <span className="font-semibold text-ink-muted">
            {g.seasonLabel ? `${g.seasonLabel} · E${g.number}` : `E${g.number}`}
          </span>
          {g.airDate && (
            <>
              <span>·</span>
              <CalendarDays size={11} />
              <span>{formatAirDate(g.airDate)}</span>
            </>
          )}
        </span>
        {g.overview && (
          <div className="max-h-28 overflow-y-auto pe-1 text-[12.5px] leading-relaxed text-ink-muted [scrollbar-width:thin]">
            {g.overview}
          </div>
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => g.play({ resume: !watched && ratio > 0.01 })}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-ink text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            {watched ? (
              <RotateCcw size={14} strokeWidth={2.4} />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
            {watched ? t("Watch again") : minsLeft > 0 ? t("Resume") : t("Play")}
          </button>
          <EpisodeDownloadButton
            meta={meta}
            episode={{
              season: g.season,
              episode: g.number,
              runtime: g.runtime ?? undefined,
              name: g.title,
              still: g.stills[0],
              overview: g.overview,
            }}
            size={36}
          />
          <button
            onClick={() => openEpisodeDetail(meta.id, g.season, g.number, meta)}
            aria-label={t("Episode details")}
            title={t("Episode details")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <Info size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
