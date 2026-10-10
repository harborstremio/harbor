import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { recordManualWatchedMeta, setManualWatchedMany } from "@/lib/manual-watched";
import type { Episode } from "@/lib/providers/tmdb";
import { markEpisodesWatched, unmarkEpisodesWatched } from "@/lib/simkl/history";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { airedOnly } from "../helpers";

export function useMarkSeason({
  meta,
  active,
  enrichedEpisodes,
  simklConnected,
}: {
  meta: Meta;
  active: number;
  enrichedEpisodes: Episode[];
  simklConnected: boolean;
}): (watched: boolean) => void {
  return useCallback(
    (watched: boolean) => {
      const airedEpisodes = watched
        ? airedOnly(enrichedEpisodes, (ep) => ep.airDate)
        : enrichedEpisodes;
      if (airedEpisodes.length === 0) return;
      if (watched)
        recordManualWatchedMeta(meta.id, {
          type: "series",
          name: meta.name,
          poster: meta.poster,
          background: meta.background,
        });
      setManualWatchedMany(
        meta.id,
        airedEpisodes.map((ep) => ({ season: ep.seasonNumber, episode: ep.episodeNumber })),
        watched,
      );
      if (!simklConnected) return;
      const r = stremioIdToSimklTarget(meta.id, { season: active, episode: 1 });
      const showIds =
        r.ok &&
        (r.target.kind === "episode"
          ? r.target.show.ids
          : r.target.kind === "anime-episode"
            ? r.target.anime.ids
            : null);
      if (!showIds) return;
      if (watched) {
        void markEpisodesWatched(
          showIds,
          active,
          airedEpisodes.map((e) => e.episodeNumber),
        );
      } else {
        void unmarkEpisodesWatched(
          showIds,
          active,
          airedEpisodes.map((e) => e.episodeNumber),
        );
      }
    },
    [meta, active, enrichedEpisodes, simklConnected],
  );
}
