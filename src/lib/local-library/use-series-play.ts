import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useView, type PlayEpisode } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { findLocalEpisodeVersions } from "@/lib/local-library/versions";
import { openLocalVersions } from "@/lib/player/local-versions-modal";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { metaIsAnime } from "@/lib/player/anime-src";
import { openLocalEpisodes } from "@/lib/player/local-episodes-modal";

type PlayOpts = { autoPlay?: boolean; resume?: boolean };

export function useLocalAwareSeriesPlay() {
  const { openPicker, openPlayer } = useView();
  const { settings } = useSettings();
  return useCallback(
    (args: {
      meta: Meta;
      episode: PlayEpisode;
      opts?: PlayOpts;
      imdbId?: string | null;
      videos?: Meta["videos"];
    }) => {
      const { meta, episode, opts, imdbId, videos } = args;
      const srcIsAnime = metaIsAnime(meta);
      const stream = () => openPicker(meta, episode, opts);
      if (settings.localPlaybackMode === "stream") {
        stream();
        return;
      }
      const m = meta.id.match(/^tmdb:tv:(\d+)$/);
      const tmdbId = m ? parseInt(m[1], 10) : null;
      const seriesImdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
      const versions = findLocalEpisodeVersions(
        episode.season,
        episode.episode,
        tmdbId,
        seriesImdb,
      );
      const thisLocal = versions[0];
      if (!thisLocal) {
        stream();
        return;
      }
      if (settings.localPlaybackMode === "local") {
        if (versions.length > 1) {
          openLocalVersions({
            title: meta.name,
            poster: meta.poster,
            entries: versions,
            onPlayLocal: (e) => openPlayer(localPlayerSrc(e, srcIsAnime)),
          });
          return;
        }
        openPlayer(localPlayerSrc(thisLocal, srcIsAnime));
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
        onPlayLocal: (e) => openPlayer(localPlayerSrc(e, srcIsAnime)),
        onStream: stream,
      });
    },
    [openPicker, openPlayer, settings.localPlaybackMode],
  );
}
