import type { Meta } from "@/lib/cinemeta";
import { getEpisodeProgress } from "@/lib/episode-progress";
import { manualWatchedVersion, subscribeManualWatched } from "@/lib/manual-watched";
import type { Episode } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { spoilerMaskFor } from "@/lib/spoilers";
import { useMemo, useSyncExternalStore } from "react";

import { EpisodeGridSkeleton } from "../episode-grid-skeleton";
import { EpisodeStrip } from "../episode-strip";
import { EpisodeRow } from "../series-episode-row";

export function OrderedEpisodes({
  meta,
  episodes,
  loading,
  traktKey,
  traktWatched,
  stremioWatched,
  simklWatched,
  cinemetaVideos,
  seriesImdbId,
  onContextMenu,
}: {
  meta: Meta;
  episodes: Episode[];
  loading: boolean;
  traktKey: string;
  traktWatched: Set<string>;
  stremioWatched?: Set<string>;
  simklWatched: Set<string>;
  cinemetaVideos?: NonNullable<Meta["videos"]>;
  seriesImdbId?: string | null;
  onContextMenu: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  const { settings } = useSettings();
  const mwVersion = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);

  const progressByKey = useMemo(() => {
    const m = new Map<string, { ratio: number; watched: boolean; startedAt: number }>();
    for (const ep of episodes) {
      m.set(
        `${ep.seasonNumber}:${ep.episodeNumber}`,
        getEpisodeProgress(
          meta.id,
          ep.seasonNumber,
          ep.episodeNumber,
          ep.runtime,
          traktKey,
          traktWatched,
          stremioWatched,
          undefined,
          simklWatched,
        ),
      );
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes, meta.id, traktKey, traktWatched, stremioWatched, simklWatched, mwVersion]);

  const nextUpKey = useMemo(() => {
    for (const ep of episodes) {
      const k = `${ep.seasonNumber}:${ep.episodeNumber}`;
      if (!progressByKey.get(k)?.watched) return k;
    }
    return null;
  }, [episodes, progressByKey]);

  if (loading && episodes.length === 0) return <EpisodeGridSkeleton />;

  if (settings.episodeLayout !== "list") {
    return (
      <EpisodeStrip
        meta={meta}
        episodes={episodes}
        layout={settings.episodeLayout === "grid" ? "grid" : "strip"}
        progressFor={(ep) => progressByKey.get(`${ep.seasonNumber}:${ep.episodeNumber}`)!}
        thumbnailFor={(ep) =>
          cinemetaVideos?.find((v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber)?.thumbnail
        }
        spoilerFor={(ep) => {
          const k = `${ep.seasonNumber}:${ep.episodeNumber}`;
          return spoilerMaskFor(settings, {
            watched: progressByKey.get(k)?.watched ?? false,
            isNextUp: k === nextUpKey,
          });
        }}
        onContextMenu={onContextMenu}
        seriesImdbId={seriesImdbId}
        cinemetaVideos={cinemetaVideos}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {episodes.map((ep) => {
        const key = `${ep.seasonNumber}:${ep.episodeNumber}`;
        const progress = progressByKey.get(key)!;
        return (
          <EpisodeRow
            key={ep.id}
            meta={meta}
            ep={ep}
            cinemetaThumbnail={
              cinemetaVideos?.find((v) => v.season === ep.seasonNumber && v.episode === ep.episodeNumber)?.thumbnail
            }
            cinemetaVideos={cinemetaVideos}
            seriesImdbId={seriesImdbId}
            progress={progress}
            spoiler={spoilerMaskFor(settings, {
              watched: progress.watched,
              isNextUp: key === nextUpKey,
            })}
            onContextMenu={onContextMenu}
          />
        );
      })}
    </div>
  );
}
