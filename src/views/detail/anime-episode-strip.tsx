import { Check, Eye } from "lucide-react";
import { useMemo } from "react";
import { DragStrip } from "@/components/drag-strip";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { useView } from "@/lib/view";
import { animeSeasonKey } from "./anime-episodes/anime-season-key";
import { formatAirDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { EpisodeGrid } from "./episode-grid";
import type { GridEpisode } from "./episode-grid-types";
import { FillerBadge, UpcomingBadge } from "./badges";
import { isUpcomingDate } from "./helpers";
import { EpisodeRatingBadge } from "./episode-rating-badge";

type Progress = { ratio: number; watched: boolean; startedAt: number };

export function AnimeEpisodeStrip({
  meta,
  episodes,
  progressFor,
  spoilerFor,
  onContextMenu,
  layout = "strip",
  onReachEnd,
  metaForEp,
  showSeason,
}: {
  meta: Meta;
  episodes: KitsuEpisode[];
  progressFor: (ep: KitsuEpisode) => Progress;
  spoilerFor?: (ep: KitsuEpisode) => SpoilerMask;
  onContextMenu?: (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => void;
  layout?: "strip" | "grid";
  onReachEnd?: () => void;
  metaForEp?: (ep: KitsuEpisode) => Meta;
  showSeason?: boolean;
}) {
  const { openPicker } = useView();
  const { settings } = useSettings();
  const t = useT();

  const gridEpisodes = useMemo<GridEpisode[]>(
    () =>
      episodes.map((ep) => {
        const epMeta = metaForEp ? metaForEp(ep) : meta;
        return {
          key: String(ep.id),
          number: ep.number,
          season: animeSeasonKey(ep),
          seasonLabel: showSeason ? `S${ep.imdbSeason ?? ep.seasonNumber ?? 1}` : undefined,
          title: ep.title || t("Episode {n}", { n: ep.number }),
          stills: [ep.thumbnail, ep.thumbnailFallback, meta.background].filter(
            (u): u is string => !!u,
          ),
          runtime: ep.length,
          airDate: ep.airdate,
          overview: ep.synopsis || undefined,
          rating: ep.rating ?? undefined,
          ratingIsImdb: ep.rating != null ? !!ep.ratingIsImdb : false,
          filler: ep.filler,
          upcoming: isUpcomingDate(ep.airdate),
          meta: epMeta,
          sourceMetaId: ep.sourceMetaId,
          play: (opts) =>
            openPicker(
              epMeta,
              {
                season: animeSeasonKey(ep),
                episode: ep.number,
                name: ep.title,
                still: ep.thumbnail ?? undefined,
                overview: ep.synopsis || undefined,
                kitsuStreamId: ep.streamId,
                imdbId: ep.imdbId,
                imdbSeason: ep.imdbSeason,
                imdbEpisode: ep.imdbEpisode,
              },
              { autoPlay: settings.instantPlay, resume: opts?.resume },
            ),
        };
      }),
    [episodes, meta, metaForEp, openPicker, settings.instantPlay, t, showSeason],
  );
  const epByKey = useMemo(() => {
    const m = new Map<string, KitsuEpisode>();
    for (const e of episodes) m.set(String(e.id), e);
    return m;
  }, [episodes]);

  if (layout === "grid") {
    return (
      <EpisodeGrid
        meta={meta}
        episodes={gridEpisodes}
        progressFor={(g) => progressFor(epByKey.get(g.key)!)}
        spoilerFor={spoilerFor ? (g) => spoilerFor(epByKey.get(g.key)!) : undefined}
        onContextMenu={onContextMenu}
      />
    );
  }
  return (
    <DragStrip itemCount={episodes.length} onReachEnd={onReachEnd}>
      {episodes.map((ep) => (
        <div key={ep.id} className="w-[244px] shrink-0">
          <AnimeEpisodeStripCard
            meta={metaForEp ? metaForEp(ep) : meta}
            ep={ep}
            progress={progressFor(ep)}
            spoiler={spoilerFor?.(ep)}
            onContextMenu={onContextMenu}
            showSeason={showSeason}
          />
        </div>
      ))}
    </DragStrip>
  );
}

function AnimeEpisodeStripCard({
  meta,
  ep,
  progress,
  spoiler,
  onContextMenu,
  showSeason,
}: {
  meta: Meta;
  ep: KitsuEpisode;
  progress: Progress;
  spoiler?: SpoilerMask;
  onContextMenu?: (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => void;
  showSeason?: boolean;
}) {
  const t = useT();
  const { openPicker, openEpisodeDetail } = useView();
  const { settings } = useSettings();
  const upcoming = isUpcomingDate(ep.airdate);

  const handlePlayClick = () => {
    openPicker(
      meta,
      {
        season: animeSeasonKey(ep),
        episode: ep.number,
        name: ep.title,
        still: ep.thumbnail ?? undefined,
        overview: ep.synopsis || undefined,
        kitsuStreamId: ep.streamId,
        imdbId: ep.imdbId,
        imdbSeason: ep.imdbSeason,
        imdbEpisode: ep.imdbEpisode,
      },
      {
        autoPlay: settings.instantPlay,
        resume: !progress.watched && progress.ratio > 0.01,
      },
    );
  };

  return (
    <div
      data-ep={ep.number}
      data-no-card-ring
      onContextMenu={(e) =>
        onContextMenu?.(e, animeSeasonKey(ep), ep.number, progress.watched, ep.sourceMetaId)
      }
      className="group flex w-full flex-col gap-2.5 text-start"
    >
      <button
        type="button"
        onClick={handlePlayClick}
        className="relative aspect-video overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <div
          className={`${spoiler?.thumb ? SPOILER_THUMB_CLASS : ""} ${upcoming ? "opacity-55 saturate-50" : ""}`}
        >
          <Poster
            src={ep.thumbnail ?? undefined}
            seed={String(ep.id)}
            ratio="landscape"
            className=""
            lazy
            fallbacks={[ep.thumbnailFallback, meta.background]}
          />
        </div>
        {upcoming && (
          <span className="absolute bottom-2 start-2 transition-opacity group-hover:opacity-0">
            <UpcomingBadge />
          </span>
        )}

        {settings.showEpisodeRating && ep.rating != null && ep.rating > 0 && (
          <span className="absolute start-2 top-2 z-[6] opacity-0 drop-shadow-md transition-opacity duration-200 group-hover:opacity-100">
            <EpisodeRatingBadge value={ep.rating} isImdb={!!ep.ratingIsImdb} />
          </span>
        )}
        {ep.synopsis && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/92 via-black/55 to-transparent p-2 pt-10 text-start pointer-events-none opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="line-clamp-5 text-[9.5px] leading-[1.35] text-white/95 drop-shadow-md">
              {ep.synopsis}
            </p>
          </div>
        )}

        <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink transition-opacity group-hover:opacity-0">
          {ep.number}
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
          <span className="flex items-center gap-2">
            <span
              className={`truncate text-[13.5px] font-semibold text-ink ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}
            >
              {ep.title || t("Episode {n}", { n: ep.number })}
            </span>
            {ep.filler && <FillerBadge />}
          </span>
          <span className="text-[11.5px] text-ink-subtle">
            {showSeason
              ? `S${ep.imdbSeason ?? ep.seasonNumber ?? 1} · E${ep.number}`
              : `E${ep.number}`}
            {ep.length ? ` · ${t("{n} min", { n: ep.length })}` : ""}
            {upcoming && ep.airdate ? ` · ${formatAirDate(ep.airdate)}` : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={() => openEpisodeDetail(meta.id, animeSeasonKey(ep), ep.number, meta)}
          aria-label={t("Episode details")}
          title={t("Episode details")}
          className="flex shrink-0 items-center justify-center rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Eye size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
