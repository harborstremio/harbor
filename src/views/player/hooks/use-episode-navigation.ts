import { useCallback, useEffect, useState } from "react";
import type { PlayInvite } from "@/lib/together/protocol";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import { isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import type { Settings } from "@/lib/settings";
import type { DebridStore } from "@/lib/debrid/types";
import { fetchAdjacentEpisodes } from "@/lib/series-episodes";
import { isEpisodeHidden } from "@/lib/hidden-episodes";
import { findLocalEpisode, localShowEpisodes } from "@/lib/local-library";
import { isLocalUrl } from "@/lib/player/local-url";
import { localPlayerSrc } from "@/views/library/local-tab/show-group";
import { completedDownloadFor } from "@/lib/download/downloads-store";
import { downloadPlayerSrc } from "@/lib/download/player-src";

type OpenPicker = (
  meta: Meta,
  episode?: PlayEpisode,
  opts?: { autoPlay?: boolean; attempt?: number },
) => void;

type MetaVideo = NonNullable<Meta["videos"]>[number];

function orderedAddonVideos(videos: MetaVideo[]): MetaVideo[] {
  const allNumbered = videos.every((v) => v.season != null && (v.episode ?? v.number) != null);
  if (allNumbered) {
    return videos
      .slice()
      .sort(
        (a, b) =>
          (a.season ?? 0) - (b.season ?? 0) ||
          (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0),
      );
  }
  return videos.slice().sort((a, b) => (a.released ?? "").localeCompare(b.released ?? ""));
}

function videoAsEpisode(video: MetaVideo, index: number): PlayEpisode {
  return {
    season: video.season ?? 0,
    episode: video.episode ?? video.number ?? index + 1,
    name: video.name || video.title || undefined,
    videoId: video.id || undefined,
    still: video.thumbnail || undefined,
  };
}

function addonVideoAdjacent(
  meta: Meta,
  current: PlayEpisode,
): { prev: PlayEpisode | null; next: PlayEpisode | null } | null {
  if (!isAddonNativeMeta(meta)) return null;
  const videos = meta.videos;
  if (!videos || videos.length < 2) return null;
  const ordered = orderedAddonVideos(videos);
  let at = current.videoId ? ordered.findIndex((v) => v.id === current.videoId) : -1;
  if (at < 0) {
    at = ordered.findIndex(
      (v) => (v.season ?? 0) === current.season && (v.episode ?? v.number) === current.episode,
    );
  }
  if (at < 0) return null;
  return {
    prev: at > 0 ? videoAsEpisode(ordered[at - 1], at - 1) : null,
    next: at < ordered.length - 1 ? videoAsEpisode(ordered[at + 1], at + 1) : null,
  };
}

export function useEpisodeNavigation(params: {
  src: PlayerSrc;
  settings: Settings;
  debrids: DebridStore[];
  authKey: string | null;
  inRoom: boolean;
  isHost: boolean;
  sendInvite: (invite: PlayInvite) => void;
  claimHost: (fresh: boolean) => void;
  replacePlayerSrc: (src: PlayerSrc) => void;
  openPicker: OpenPicker;
}) {
  const { src, settings, inRoom, isHost, openPicker, replacePlayerSrc } = params;

  const [adjacent, setAdjacent] = useState<{ prev: PlayEpisode | null; next: PlayEpisode | null }>({
    prev: null,
    next: null,
  });

  const localShowKey = isLocalUrl(src.url)
    ? {
        imdbId: src.imdbId ?? (src.meta.id.startsWith("tt") ? src.meta.id : null),
        title: src.meta.name,
      }
    : null;

  useEffect(() => {
    if (src.meta.type !== "series" || !src.episode) {
      const fromVideos = src.episode ? addonVideoAdjacent(src.meta, src.episode) : null;
      setAdjacent(fromVideos ?? { prev: null, next: null });
      return;
    }
    let cancelled = false;
    const cur = { season: src.episode.season, episode: src.episodeEnd ?? src.episode.episode };
    fetchAdjacentEpisodes(src.meta, cur, {
      tmdbKey: settings.tmdbKey,
      kitsuStreamId: src.episode.kitsuStreamId,
      skip: settings.episodeHiding ? (s, e) => isEpisodeHidden(src.meta.id, s, e) : undefined,
    }).then((r) => {
      if (cancelled) return;
      if (localShowKey) {
        const eps = localShowEpisodes(localShowKey);
        const i = eps.findIndex((e) => e.season === cur.season && e.episode === cur.episode);
        const localPrev = i > 0 ? eps[i - 1] : null;
        const localNext = i >= 0 && i < eps.length - 1 ? eps[i + 1] : null;
        setAdjacent({
          prev:
            r.prev ??
            (localPrev
              ? { season: localPrev.season as number, episode: localPrev.episode as number }
              : null),
          next:
            r.next ??
            (localNext
              ? { season: localNext.season as number, episode: localNext.episode as number }
              : null),
        });
        return;
      }
      setAdjacent(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    src.meta.id,
    src.meta.type,
    src.meta.videos,
    src.episode,
    src.url,
    settings.tmdbKey,
    settings.episodeHiding,
  ]);

  const goToEpisode = useCallback(
    (ep: PlayEpisode | null) => {
      if (!ep) return;
      if (inRoom && !isHost) return;
      if (localShowKey) {
        const local = findLocalEpisode(localShowKey, ep.season, ep.episode);
        if (local) {
          replacePlayerSrc(localPlayerSrc(local, undefined, ep));
          return;
        }
      }
      const carried =
        src.meta.id.startsWith("tt") && src.episode?.sourceMetaId && !ep.sourceMetaId
          ? { ...ep, sourceMetaId: src.episode.sourceMetaId }
          : ep;
      const withoutDownload = () => {
        if (localShowKey) {
          const local = findLocalEpisode(localShowKey, ep.season, ep.episode);
          if (local) {
            replacePlayerSrc(localPlayerSrc(local));
            return;
          }
        }
        openPicker(src.meta, carried, { autoPlay: true });
      };
      if (inRoom || settings.localPlaybackMode === "stream") {
        withoutDownload();
        return;
      }
      void completedDownloadFor(src.meta.id, ep.season, ep.episode).then((item) => {
        if (!item) {
          withoutDownload();
          return;
        }
        replacePlayerSrc(
          downloadPlayerSrc(src.meta, ep, item, { imdbId: src.imdbId, isAnime: src.isAnime }),
        );
      }, withoutDownload);
    },
    [
      openPicker,
      replacePlayerSrc,
      src.meta,
      src.episode,
      src.imdbId,
      src.isAnime,
      src.url,
      settings.localPlaybackMode,
      inRoom,
      isHost,
    ],
  );

  return { adjacent, swappingEp: false, goToEpisode };
}
