import { Check, Play } from "lucide-react";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { formatAirDate } from "@/lib/dates";
import { formatRelativeWatched } from "@/lib/episode-progress";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { animeSeasonKey } from "./anime-season-key";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { FillerBadge, UpcomingBadge } from "../badges";
import { EpisodeRatingBadge } from "../episode-rating-badge";
import { EpisodeDownloadButton } from "../episode-download-button";
import { isUpcomingDate } from "../helpers";

export function AnimeEpisodeRow({
  meta,
  ep,
  progress,
  spoiler,
  onContextMenu,
  metaForEp,
  showSeason,
}: {
  meta: Meta;
  ep: KitsuEpisode;
  progress: { ratio: number; watched: boolean; startedAt: number };
  spoiler?: SpoilerMask;
  onContextMenu?: (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => void;
  metaForEp?: (ep: KitsuEpisode) => Meta;
  showSeason?: boolean;
}) {
  const t = useT();
  const { openPicker } = useView();
  const { settings } = useSettings();
  const epMeta = metaForEp ? metaForEp(ep) : meta;
  const watchedAgo = progress.startedAt > 0 ? formatRelativeWatched(progress.startedAt) : "";
  const playEpisode = {
    season: animeSeasonKey(ep),
    episode: ep.number,
    name: ep.title,
    still: ep.thumbnail ?? undefined,
    overview: ep.synopsis || undefined,
    kitsuStreamId: ep.streamId,
    imdbId: ep.imdbId,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
  };
  return (
    <div
      data-ep={ep.number}
      data-no-card-ring
      onContextMenu={(e) =>
        onContextMenu?.(e, animeSeasonKey(ep), ep.number, progress.watched, ep.sourceMetaId)
      }
      className="group flex gap-6 rounded-2xl px-4 py-5 transition-colors hover:bg-elevated/30"
    >
      <button
        onClick={() =>
          openPicker(epMeta, playEpisode, {
            autoPlay: settings.instantPlay,
            resume: !progress.watched && progress.ratio > 0.01,
          })
        }
        className="flex min-w-0 flex-1 gap-6 text-start"
      >
        <div className="relative w-[200px] shrink-0">
          <div
            className={
              spoiler?.thumb ? `overflow-hidden rounded-lg ${SPOILER_THUMB_CLASS}` : undefined
            }
          >
            <Poster
              src={ep.thumbnail ?? undefined}
              seed={String(ep.id)}
              ratio="landscape"
              className="rounded-lg"
              lazy
              fallbacks={[ep.thumbnailFallback, meta.background]}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Play size={18} fill="currentColor" />
            </div>
          </div>
          <span className="absolute start-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
            {ep.number}
          </span>
          {settings.showEpisodeRating && ep.rating != null && ep.rating > 0 && (
            <span className="absolute bottom-2 start-2 z-[6] drop-shadow-md">
              <EpisodeRatingBadge value={ep.rating} isImdb={!!ep.ratingIsImdb} />
            </span>
          )}
          {progress.watched && (
            <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {progress.ratio > 0.01 && (
            <div className="absolute inset-x-1 bottom-1 h-[3px] overflow-hidden rounded-full bg-black/55">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, progress.ratio * 100)}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h4 className="flex items-center gap-2 truncate text-[16px] font-semibold text-ink">
            <span className={`truncate ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}>
              {ep.title || t("Episode {n}", { n: ep.number })}
            </span>
            {ep.filler && <FillerBadge />}
            {isUpcomingDate(ep.airdate) ? <UpcomingBadge /> : null}
          </h4>
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-subtle">
            <span>
              {[
                showSeason
                  ? `S${ep.imdbSeason ?? ep.seasonNumber ?? 1} · E${ep.number}`
                  : `E${ep.number}`,
                ep.absoluteNumber && ep.absoluteNumber !== ep.number
                  ? `Abs E${ep.absoluteNumber}`
                  : null,
                ep.length ? t("{n} min", { n: ep.length }) : null,
                formatAirDate(ep.airdate) || null,
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
          {ep.synopsis && (
            <p
              className={`line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted ${
                spoiler?.desc ? SPOILER_TEXT_CLASS : ""
              }`}
            >
              {ep.synopsis}
            </p>
          )}
        </div>
      </button>
      <EpisodeDownloadButton meta={epMeta} episode={playEpisode} />
    </div>
  );
}
