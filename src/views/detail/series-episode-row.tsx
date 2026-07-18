import { Check, Eye, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EpisodeRatingBadge } from "./episode-rating-badge";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { formatAirDate } from "@/lib/dates";
import { formatRelativeWatched } from "@/lib/episode-progress";
import type { Episode } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { useView } from "@/lib/view";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useT } from "@/lib/i18n";
import { prefetchSegments } from "@/lib/skip-intro";
import { NewBadge, UpcomingBadge } from "./badges";
import { EpisodeDownloadButton } from "./episode-download-button";
import { isNewEpisode, isUpcomingEpisode } from "./helpers";

export function EpisodeRow({
  meta,
  ep,
  progress,
  cinemetaThumbnail,
  cinemetaVideos,
  seriesImdbId,
  spoiler,
  onContextMenu,
}: {
  meta: Meta;
  ep: Episode;
  progress: { ratio: number; watched: boolean; startedAt: number };
  cinemetaThumbnail?: string;
  cinemetaVideos?: Meta["videos"];
  seriesImdbId?: string | null;
  spoiler?: SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  const t = useT();
  const { openEpisodeDetail } = useView();
  const playEpisodeLocalAware = useLocalAwareSeriesPlay();
  const { settings } = useSettings();
  const ratingValue = ep.imdbRating ?? ep.voteAverage;
  const ratingIsImdb = ep.imdbRating != null;
  const tmdbStill = ep.stillPath
    ? `https://image.tmdb.org/t/p/${settings.hdEpisodeImages ? "original" : "w300"}${ep.stillPath}`
    : ep.stillUrl;
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [tmdbStill, cinemetaThumbnail]) {
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }, [tmdbStill, cinemetaThumbnail]);
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => {
    setImgIdx(0);
  }, [ep.id]);
  const still = candidates[imgIdx];
  const watchedAgo = progress.startedAt > 0 ? formatRelativeWatched(progress.startedAt) : "";
  const resolvedImdbId = useMemo(() => {
    const v = cinemetaVideos?.find(
      (x) => x.season === ep.seasonNumber && x.episode === ep.episodeNumber,
    );
    return v?.id ?? undefined;
  }, [cinemetaVideos, ep.seasonNumber, ep.episodeNumber]);
  const playEpisode = {
    season: ep.seasonNumber,
    episode: ep.episodeNumber,
    runtime: ep.runtime ?? undefined,
    name: ep.name || undefined,
    still,
    overview: ep.overview || undefined,
    imdbId: resolvedImdbId,
  };

  return (
    <div
      data-ep={ep.episodeNumber}
      data-no-card-ring
      onContextMenu={(e) => onContextMenu?.(e, ep.seasonNumber, ep.episodeNumber, progress.watched)}
      onMouseEnter={() => prefetchSegments(meta, playEpisode)}
      className="group flex gap-6 rounded-2xl px-4 py-5 transition-colors hover:bg-elevated/30"
    >
      <button
        onClick={() =>
          playEpisodeLocalAware({
            meta,
            episode: playEpisode,
            opts: {
              autoPlay: settings.instantPlay || settings.seasonSourceLock,
              resume: !progress.watched && progress.ratio > 0.01,
            },
            imdbId: seriesImdbId,
            videos: cinemetaVideos,
          })
        }
        onFocus={() => prefetchSegments(meta, playEpisode)}
        className="flex min-w-0 flex-1 gap-6 text-start"
      >
        <div className="relative w-[200px] shrink-0 overflow-hidden rounded-lg">
          <div className={spoiler?.thumb ? SPOILER_THUMB_CLASS : undefined}>
            <Poster
              src={still}
              seed={String(ep.id)}
              ratio="landscape"
              lazy
              onError={() => setImgIdx((i) => i + 1)}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
          <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {ep.episodeNumber}
          </span>
          {progress.watched && (
            <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {settings.showEpisodeRating && ratingValue != null && ratingValue > 0 && (
            <div className="pointer-events-none absolute bottom-2 start-2 z-[5] flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 drop-shadow-md backdrop-blur-sm">
              <EpisodeRatingBadge value={ratingValue} isImdb={ratingIsImdb} />
            </div>
          )}
          {progress.ratio > 0.01 && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.max(2, progress.ratio * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 className="flex items-center gap-2 truncate text-[16px] font-semibold text-ink">
            <span className={`truncate ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}>
              {ep.name || t("Episode {n}", { n: ep.episodeNumber })}
            </span>
            {isUpcomingEpisode(ep) ? <UpcomingBadge /> : isNewEpisode(ep) && <NewBadge />}
          </h4>
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-subtle">
            <span>
              {[
                `S${ep.seasonNumber} E${ep.episodeNumber}`,
                ep.runtime ? t("{n} min", { n: ep.runtime }) : null,
                formatAirDate(ep.airDate) || null,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </span>
            {progress.watched && watchedAgo && (
              <span className="text-emerald-300/85">
                · {t("Watched {ago}", { ago: watchedAgo })}
              </span>
            )}
            {!progress.watched && progress.ratio > 0.01 && watchedAgo && (
              <span className="text-accent/85">
                · {t("{pct}% watched", { pct: Math.round(progress.ratio * 100) })} · {watchedAgo}
              </span>
            )}
          </p>
          {ep.overview && (
            <p
              className={`line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted ${
                spoiler?.desc ? SPOILER_TEXT_CLASS : ""
              }`}
            >
              {ep.overview}
            </p>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={() => openEpisodeDetail(meta.id, ep.seasonNumber, ep.episodeNumber, meta)}
        aria-label={t("Episode details")}
        title={t("Episode details")}
        className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
      >
        <Eye size={18} strokeWidth={2} />
      </button>
      <EpisodeDownloadButton meta={meta} episode={playEpisode} />
    </div>
  );
}
