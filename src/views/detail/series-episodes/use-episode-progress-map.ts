import { useMemo } from "react";
import { getEpisodeProgress } from "@/lib/episode-progress";
import { spoilerMaskFor, type SpoilerMask } from "@/lib/spoilers";
import type { Episode } from "@/lib/providers/tmdb";
import { airedOnly } from "../helpers";

export function useEpisodeProgressMap({
  episodes,
  metaId,
  traktKey,
  traktWatched,
  stremioWatched,
  simklWatched,
  mwVersion,
  settings,
}: {
  episodes: Episode[];
  metaId: string;
  traktKey: string;
  traktWatched: Set<string>;
  stremioWatched?: Set<string>;
  simklWatched?: Set<string>;
  mwVersion: number;
  settings: Parameters<typeof spoilerMaskFor>[0];
}) {
  const progressByEp = useMemo(() => {
    const m = new Map<number, ReturnType<typeof getEpisodeProgress>>();
    for (const ep of episodes) {
      m.set(
        ep.episodeNumber,
        getEpisodeProgress(
          metaId,
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
  }, [episodes, metaId, traktKey, traktWatched, stremioWatched, simklWatched, mwVersion]);

  const nextUpEp = useMemo(() => {
    for (const ep of episodes) {
      if (!progressByEp.get(ep.episodeNumber)?.watched) return ep.episodeNumber;
    }
    return null;
  }, [episodes, progressByEp]);

  const spoilerFor = (epNumber: number): SpoilerMask =>
    spoilerMaskFor(settings, {
      watched: progressByEp.get(epNumber)?.watched ?? false,
      isNextUp: epNumber === nextUpEp,
    });

  const airedEps = airedOnly(episodes, (ep) => ep.airDate);
  const allWatched =
    airedEps.length > 0 && airedEps.every((ep) => progressByEp.get(ep.episodeNumber)?.watched);

  return { progressByEp, nextUpEp, spoilerFor, allWatched };
}
