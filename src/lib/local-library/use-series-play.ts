import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useView, type PlayEpisode } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { findLocalEpisodeVersions } from "@/lib/local-library/versions";
import { openLocalVersions } from "@/lib/player/local-versions-modal";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { metaIsAnime } from "@/lib/player/anime-src";
import { mediaServerConnections } from "@/lib/media-server/connections";
import { mediaServerItems } from "@/lib/media-server/index-store";
import { matchingServerItems, serverPlayableCopies } from "@/lib/media-server/selectors";
import { createMediaServerPlayerSrc, decidePlaybackSource } from "@/lib/media-server/playback";

type PlayOpts = { autoPlay?: boolean; resume?: boolean };

export function useLocalAwareSeriesPlay() {
  const { openPicker, openPlayer } = useView();
  const { settings } = useSettings();
  return useCallback(
    async (args: {
      meta: Meta;
      episode: PlayEpisode;
      opts?: PlayOpts;
      imdbId?: string | null;
      videos?: Meta["videos"];
    }) => {
      const { meta, episode, opts, imdbId } = args;
      const srcIsAnime = metaIsAnime(meta);
      const stream = () => openPicker(meta, episode, opts);
      const m = meta.id.match(/^tmdb:tv:(\d+)$/);
      const tmdbId = m ? parseInt(m[1], 10) : null;
      const seriesImdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
      const versions = findLocalEpisodeVersions(
        episode.season,
        episode.episode,
        tmdbId,
        seriesImdb,
      );
      const connections = mediaServerConnections();
      const indexedItems = await mediaServerItems();
      const identity = { tmdbId: tmdbId ?? undefined, imdbId: seriesImdb ?? undefined };
      const serverItems = matchingServerItems(
        indexedItems,
        identity,
        "series",
        episode.season,
        episode.episode,
      );
      const serverCopies = serverPlayableCopies(serverItems, connections);
      const decision = decidePlaybackSource(settings, versions.length, serverCopies);
      if (decision.kind === "online") {
        stream();
        return;
      }
      if (decision.kind === "local" && versions[0]) {
        openPlayer(localPlayerSrc(versions[0], srcIsAnime, episode));
        return;
      }
      if (decision.kind === "home-server") {
        const item = serverItems.find(
          (candidate) =>
            candidate.connectionId === decision.copy.connectionId &&
            candidate.id === decision.copy.itemId,
        );
        const connection =
          item && connections.find((candidate) => candidate.id === item.connectionId);
        if (item && connection)
          openPlayer(
            await createMediaServerPlayerSrc({
              meta,
              imdbId: seriesImdb ?? undefined,
              episode,
              connection,
              item,
              versionId: decision.copy.version.id,
            }),
          );
        return;
      }
      openLocalVersions({
        title: meta.name,
        poster: meta.poster,
        entries: versions,
        onPlayLocal: (entry) => openPlayer(localPlayerSrc(entry, srcIsAnime, episode)),
        serverCopies,
        onPlayServer: async (copy) => {
          const item = serverItems.find(
            (candidate) =>
              candidate.connectionId === copy.connectionId && candidate.id === copy.itemId,
          );
          const connection =
            item && connections.find((candidate) => candidate.id === item.connectionId);
          if (item && connection)
            openPlayer(
              await createMediaServerPlayerSrc({
                meta,
                imdbId: seriesImdb ?? undefined,
                episode,
                connection,
                item,
                versionId: copy.version.id,
              }),
            );
        },
        onStream: stream,
      });
    },
    [openPicker, openPlayer, settings.playbackSourcePreference, settings.preferredMediaServerId],
  );
}
