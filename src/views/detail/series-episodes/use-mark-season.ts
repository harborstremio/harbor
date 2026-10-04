import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { recordManualWatchedMeta, setManualWatchedMany } from "@/lib/manual-watched";
import type { Episode } from "@/lib/providers/tmdb";
import { markEpisodesWatched, unmarkEpisodesWatched } from "@/lib/simkl/history";
import { stremioIdToSimklTarget } from "@/lib/simkl/ids";
import { markPmdbWatched, unmarkPmdbWatched } from "@/lib/publicmetadb/history";
import { stremioIdToPmdbTarget } from "@/lib/publicmetadb/ids";
import { usePublicMetaDb } from "@/lib/publicmetadb/provider";
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
  const { isConnected: pmdbConnected } = usePublicMetaDb();
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
      if (pmdbConnected) {
        for (const ep of airedEpisodes) {
          const target = stremioIdToPmdbTarget(
            meta.id,
            { season: ep.seasonNumber, episode: ep.episodeNumber },
            "tv",
          );
          if (target) {
            if (watched) void markPmdbWatched(target);
            else void unmarkPmdbWatched(target);
          }
        }
      }
    },
    [meta, active, enrichedEpisodes, simklConnected, pmdbConnected],
  );
}
