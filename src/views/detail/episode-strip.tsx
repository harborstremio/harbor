import { Check, Eye } from "lucide-react";
import { EpisodeRatingBadge } from "./episode-rating-badge";
import { useEffect, useMemo, useState } from "react";
import { DragStrip } from "@/components/drag-strip";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import type { Episode } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { useView } from "@/lib/view";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useT } from "@/lib/i18n";
import { EpisodeGrid } from "./episode-grid";
import type { GridEpisode } from "./episode-grid-types";
import { EpisodeDownloadButton } from "./episode-download-button";
import { isUpcomingDate } from "./helpers";

type Progress = { ratio: number; watched: boolean; startedAt: number };

export function EpisodeStrip({
  meta,
  episodes,
  progressFor,
  thumbnailFor,
  spoilerFor,
  onContextMenu,
  layout = "strip",
  seriesImdbId,
  cinemetaVideos,
}: {
  meta: Meta;
  episodes: Episode[];
  progressFor: (ep: Episode) => Progress;
  thumbnailFor: (ep: Episode) => string | undefined;
  spoilerFor?: (ep: Episode) => SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
  layout?: "strip" | "grid";
  seriesImdbId?: string | null;
  cinemetaVideos?: Meta["videos"];
}) {
  const { settings } = useSettings();
  const playLocalAware = useLocalAwareSeriesPlay();
  const t = useT();

  const gridEpisodes = useMemo<GridEpisode[]>(
    () =>
      episodes.map((ep) => {
        const tmdbStill = ep.stillPath
          ? `https://image.tmdb.org/t/p/${settings.hdEpisodeImages ? "original" : "w300"}${ep.stillPath}`
          : ep.stillUrl;
        const stills = [tmdbStill, thumbnailFor(ep)].filter((u): u is string => !!u);
        return {
          key: String(ep.id),
          number: ep.episodeNumber,
          season: ep.seasonNumber,
          title: ep.name || t("Episode {n}", { n: ep.episodeNumber }),
          stills,
          runtime: ep.runtime,
          airDate: ep.airDate,
          overview: ep.overview || undefined,
          rating: ep.imdbRating ?? ep.voteAverage ?? undefined,
          ratingIsImdb: ep.imdbRating != null,
          upcoming: isUpcomingDate(ep.airDate),
          play: (opts) =>
            playLocalAware({
              meta,
              episode: {
                season: ep.seasonNumber,
                episode: ep.episodeNumber,
                runtime: ep.runtime ?? undefined,
                name: ep.name || undefined,
                still: stills[0],
                overview: ep.overview || undefined,
              },
              opts: {
                autoPlay: settings.instantPlay || settings.seasonSourceLock,
                resume: opts?.resume,
              },
              imdbId: seriesImdbId,
              videos: cinemetaVideos,
            }),
        };
      }),
    [
      episodes,
      thumbnailFor,
      meta,
      playLocalAware,
      settings.instantPlay,
      settings.seasonSourceLock,
      settings.hdEpisodeImages,
      t,
      seriesImdbId,
      cinemetaVideos,
    ],
  );
  const epByNumber = useMemo(() => {
    const m = new Map<number, Episode>();
    for (const e of episodes) m.set(e.episodeNumber, e);
    return m;
  }, [episodes]);

  if (layout === "grid") {
    return (
      <EpisodeGrid
        meta={meta}
        episodes={gridEpisodes}
        progressFor={(g) => progressFor(epByNumber.get(g.number)!)}
        spoilerFor={spoilerFor ? (g) => spoilerFor(epByNumber.get(g.number)!) : undefined}
        onContextMenu={onContextMenu}
      />
    );
  }
  return (
    <DragStrip itemCount={episodes.length}>
      {episodes.map((ep) => (
        <div key={ep.id} className="w-[244px] shrink-0">
          <EpisodeStripCard
            meta={meta}
            ep={ep}
            progress={progressFor(ep)}
            thumbnail={thumbnailFor(ep)}
            spoiler={spoilerFor?.(ep)}
            onContextMenu={onContextMenu}
            seriesImdbId={seriesImdbId}
            cinemetaVideos={cinemetaVideos}
          />
        </div>
      ))}
    </DragStrip>
  );
}

function EpisodeStripCard({
  meta,
  ep,
  progress,
  thumbnail,
  spoiler,
  onContextMenu,
  seriesImdbId,
  cinemetaVideos,
}: {
  meta: Meta;
  ep: Episode;
  progress: Progress;
  thumbnail?: string;
  spoiler?: SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
  seriesImdbId?: string | null;
  cinemetaVideos?: Meta["videos"];
}) {
  const t = useT();
  const { openEpisodeDetail } = useView();
  const playLocalAware = useLocalAwareSeriesPlay();
  const { settings } = useSettings();
  const ratingValue = ep.imdbRating ?? ep.voteAverage;
  const ratingIsImdb = ep.imdbRating != null;

  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => {
    setImgIdx(0);
  }, [ep.id]);

  const still = useMemo(() => {
    const tmdbSize = settings.hdEpisodeImages ? "original" : "w300";
    if (imgIdx === 0 && ep.stillPath)
      return `https://image.tmdb.org/t/p/${tmdbSize}${ep.stillPath}`;
    if (imgIdx === 0 && !ep.stillPath && ep.stillUrl) return ep.stillUrl;
    if (imgIdx <= 1 && thumbnail) return thumbnail;
    return undefined;
  }, [ep.stillPath, ep.stillUrl, imgIdx, thumbnail, settings.hdEpisodeImages]);

  const handlePlayClick = () => {
    playLocalAware({
      meta,
      episode: {
        season: ep.seasonNumber,
        episode: ep.episodeNumber,
        runtime: ep.runtime ?? undefined,
        name: ep.name || undefined,
        still,
        overview: ep.overview || undefined,
      },
      opts: {
        autoPlay: settings.instantPlay || settings.seasonSourceLock,
        resume: !progress.watched && progress.ratio > 0.01,
      },
      imdbId: seriesImdbId,
      videos: cinemetaVideos,
    });
  };

  return (
    <div
      data-ep={ep.episodeNumber}
      data-no-card-ring
      onContextMenu={(e) => onContextMenu?.(e, ep.seasonNumber, ep.episodeNumber, progress.watched)}
      className="group flex w-full flex-col gap-2.5 text-start"
    >
      <button
        type="button"
        onClick={handlePlayClick}
        className="relative aspect-video overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <div className={spoiler?.thumb ? SPOILER_THUMB_CLASS : undefined}>
          <Poster
            src={still}
            seed={String(ep.id)}
            ratio="landscape"
            className=""
            onError={() => setImgIdx((i) => i + 1)}
          />
        </div>

        {settings.showEpisodeRating && ratingValue != null && ratingValue > 0 && (
          <div className="pointer-events-none absolute start-2 top-2 z-[6] flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 opacity-0 drop-shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            <EpisodeRatingBadge value={ratingValue} isImdb={ratingIsImdb} />
          </div>
        )}
        {settings.showEpisodeDescription && ep.overview && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/92 via-black/55 to-transparent p-2 pt-10 text-start pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="line-clamp-5 text-[9.5px] leading-[1.35] text-white/95 drop-shadow-md">
              {ep.overview}
            </p>
          </div>
        )}

        <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink transition-opacity group-hover:opacity-0">
          {ep.episodeNumber}
        </span>
        {progress.watched && (
          <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm transition-opacity group-hover:opacity-0">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {progress.ratio > 0.01 && (
          <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-black/55 transition-opacity group-hover:opacity-0">
            <div
              className="h-full bg-accent"
              style={{ width: `${Math.max(2, progress.ratio * 100)}%` }}
            />
          </div>
        )}
      </button>
      <div className="flex items-start justify-between gap-2 px-0.5">
        <button
          type="button"
          onClick={handlePlayClick}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-start focus-visible:outline-none"
        >
          <span
            className={`truncate text-[13.5px] font-semibold text-ink ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}
          >
            {ep.name || t("Episode {n}", { n: ep.episodeNumber })}
          </span>
          <span className="text-[11.5px] text-ink-subtle">
            S{ep.seasonNumber} E{ep.episodeNumber}
            {ep.runtime ? ` · ${t("{n} min", { n: ep.runtime })}` : ""}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <EpisodeDownloadButton
            meta={meta}
            episode={{
              season: ep.seasonNumber,
              episode: ep.episodeNumber,
              runtime: ep.runtime ?? undefined,
              name: ep.name || undefined,
              still,
              overview: ep.overview || undefined,
            }}
            size={30}
          />
          <button
            type="button"
            onClick={() => openEpisodeDetail(meta.id, ep.seasonNumber, ep.episodeNumber, meta)}
            aria-label={t("Episode details")}
            title={t("Episode details")}
            className="flex items-center justify-center rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <Eye size={16} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
