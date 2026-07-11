import { getEpisodeProgress, type EpisodeProgress } from "@/lib/episode-progress";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { spoilerMaskFor, type SpoilerMask } from "@/lib/spoilers";
import { useMemo } from "react";

const NO_PROGRESS: EpisodeProgress = { ratio: 0, watched: false, startedAt: 0 };

export function useAnimeProgressMap({
  episodes,
  displayEpisodes,
  metaId,
  traktWatched,
  anilistWatched,
  malWatched,
  mwVersion,
  settings,
}: {
  episodes: KitsuEpisode[];
  displayEpisodes: KitsuEpisode[];
  metaId: string;
  traktWatched: Set<string>;
  anilistWatched?: Set<string>;
  malWatched?: Set<string>;
  mwVersion: number;
  settings: Parameters<typeof spoilerMaskFor>[0];
}) {
  const progressById = useMemo(() => {
    const m = new Map<number, EpisodeProgress>();
    const add = (ep: KitsuEpisode) => {
      if (m.has(ep.id)) return;
      const isCurrent = ep.sourceMetaId == null;
      m.set(
        ep.id,
        getEpisodeProgress(
          ep.sourceMetaId ?? metaId,
          ep.seasonNumber || 1,
          ep.number,
          ep.length ?? null,
          ep.imdbId ?? null,
          traktWatched,
          undefined,
          isCurrent ? anilistWatched : undefined,
          undefined,
          isCurrent ? malWatched : undefined,
          ep.imdbSeason,
          ep.imdbEpisode,
        ),
      );
    };
    for (const ep of episodes) add(ep);
    for (const ep of displayEpisodes) add(ep);
    return m;
  }, [episodes, displayEpisodes, metaId, traktWatched, anilistWatched, malWatched, mwVersion]);

  const progressFor = (ep: KitsuEpisode) => progressById.get(ep.id) ?? NO_PROGRESS;

  const nextUpNum = useMemo(() => {
    for (const ep of episodes) {
      if (!progressById.get(ep.id)?.watched) return ep.number;
    }
    return null;
  }, [episodes, progressById]);

  const spoilerFor = (ep: KitsuEpisode): SpoilerMask =>
    spoilerMaskFor(settings, {
      watched: progressById.get(ep.id)?.watched ?? false,
      isNextUp: ep.number === nextUpNum,
    });

  const allWatched = displayEpisodes.length > 0 && displayEpisodes.every((ep) => progressById.get(ep.id)?.watched);

  return { progressFor, nextUpNum, spoilerFor, allWatched };
}
