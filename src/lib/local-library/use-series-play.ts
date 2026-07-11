import type { Meta } from "@/lib/cinemeta";
import { findLocalEpisodeByIds } from "@/lib/local-library";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { openLocalEpisodes } from "@/lib/player/local-episodes-modal";
import { useSettings } from "@/lib/settings";
import { useView, type PlayEpisode } from "@/lib/view";
import { useCallback } from "react";

type PlayOpts = { autoPlay?: boolean; resume?: boolean };

export function useLocalAwareSeriesPlay() {
  const { openPicker, openPlayer } = useView();
  const { settings } = useSettings();
  return useCallback(
    (args: { meta: Meta; episode: PlayEpisode; opts?: PlayOpts; imdbId?: string | null; videos?: Meta["videos"] }) => {
      const { meta, episode, opts, imdbId, videos } = args;
      const stream = () => openPicker(meta, episode, opts);
      if (settings.localPlaybackMode === "stream") {
        stream();
        return;
      }
      const m = meta.id.match(/^tmdb:tv:(\d+)$/);
      const tmdbId = m ? parseInt(m[1], 10) : null;
      const seriesImdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
      const thisLocal = findLocalEpisodeByIds(episode.season, episode.episode, tmdbId, seriesImdb);
      if (!thisLocal) {
        stream();
        return;
      }
      if (settings.localPlaybackMode === "local") {
        openPlayer(localPlayerSrc(thisLocal));
        return;
      }
      openLocalEpisodes({
        title: meta.name,
        tmdbId,
        imdbId: seriesImdb,
        poster: meta.poster,
        videos,
        initialSeason: episode.season,
        highlightEpisode: episode.episode,
        onPlayLocal: (e) => openPlayer(localPlayerSrc(e)),
        onStream: stream,
      });
    },
    [openPicker, openPlayer, settings.localPlaybackMode],
  );
}
