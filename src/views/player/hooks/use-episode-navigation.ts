import type { Meta } from "@/lib/cinemeta";
import type { DebridStore } from "@/lib/debrid/types";
import { findLocalEpisode, localShowEpisodes } from "@/lib/local-library";
import { isLocalUrl } from "@/lib/player/local-url";
import { fetchAdjacentEpisodes } from "@/lib/series-episodes";
import type { Settings } from "@/lib/settings";
import type { PlayInvite } from "@/lib/together/protocol";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import { localPlayerSrc } from "@/views/library/local-tab/show-group";
import { useCallback, useEffect, useState } from "react";

type OpenPicker = (meta: Meta, episode?: PlayEpisode, opts?: { autoPlay?: boolean; attempt?: number }) => void;

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
      setAdjacent({ prev: null, next: null });
      return;
    }
    let cancelled = false;
    const cur = { season: src.episode.season, episode: src.episode.episode };
    fetchAdjacentEpisodes(src.meta, cur, {
      tmdbKey: settings.tmdbKey,
      kitsuStreamId: src.episode.kitsuStreamId,
    }).then((r) => {
      if (cancelled) return;
      if (localShowKey) {
        const eps = localShowEpisodes(localShowKey);
        const i = eps.findIndex((e) => e.season === cur.season && e.episode === cur.episode);
        const localPrev = i > 0 ? eps[i - 1] : null;
        const localNext = i >= 0 && i < eps.length - 1 ? eps[i + 1] : null;
        setAdjacent({
          prev:
            r.prev ?? (localPrev ? { season: localPrev.season as number, episode: localPrev.episode as number } : null),
          next:
            r.next ?? (localNext ? { season: localNext.season as number, episode: localNext.episode as number } : null),
        });
        return;
      }
      setAdjacent(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src.meta.id, src.meta.type, src.episode, src.url, settings.tmdbKey]);

  const goToEpisode = useCallback(
    (ep: PlayEpisode | null) => {
      if (!ep) return;
      if (inRoom && !isHost) return;
      if (localShowKey) {
        const local = findLocalEpisode(localShowKey, ep.season, ep.episode);
        if (local) {
          replacePlayerSrc(localPlayerSrc(local));
          return;
        }
      }
      openPicker(src.meta, ep, { autoPlay: true });
    },
    [openPicker, replacePlayerSrc, src.meta, src.imdbId, src.url, inRoom, isHost],
  );

  return { adjacent, swappingEp: false, goToEpisode };
}
