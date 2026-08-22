import { useCallback } from "react";
import type { Meta } from "@/lib/cinemeta";
import { queueItemAfter, queueItemBefore, useQueue } from "@/lib/queue";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";

type OpenPicker = (
  meta: Meta,
  episode?: PlayEpisode,
  opts?: { autoPlay?: boolean; attempt?: number; intent?: "play" | "download"; resume?: boolean },
) => void;

export function useQueueNav(params: {
  src: PlayerSrc;
  adjacent: { prev: PlayEpisode | null; next: PlayEpisode | null };
  canChangeEpisode: boolean;
  canNavigate: boolean;
  isLiveLike: boolean;
  queueDrivesNav: boolean;
  goToEpisode: (ep: PlayEpisode | null) => void;
  openPicker: OpenPicker;
}) {
  const {
    src,
    adjacent,
    canChangeEpisode,
    canNavigate,
    isLiveLike,
    queueDrivesNav,
    goToEpisode,
    openPicker,
  } = params;
  useQueue();

  const queueNavigationEnabled = canNavigate && queueDrivesNav && !isLiveLike;
  const nextQueueItem = queueNavigationEnabled ? queueItemAfter(src.meta, src.episode) : null;
  const previousQueueItem = queueNavigationEnabled ? queueItemBefore(src.meta, src.episode) : null;
  const hasNext = !!nextQueueItem || (canChangeEpisode && !!adjacent.next);
  const hasPrevious = !!previousQueueItem || (canChangeEpisode && !!adjacent.prev);

  const playNext = useCallback(() => {
    if (nextQueueItem) {
      openPicker(nextQueueItem.meta, nextQueueItem.episode, { autoPlay: true, resume: true });
      return;
    }
    if (canChangeEpisode) goToEpisode(adjacent.next);
  }, [nextQueueItem, openPicker, canChangeEpisode, goToEpisode, adjacent.next]);

  const playPrevious = useCallback(() => {
    if (previousQueueItem) {
      openPicker(previousQueueItem.meta, previousQueueItem.episode, {
        autoPlay: true,
        resume: true,
      });
      return;
    }
    if (canChangeEpisode) goToEpisode(adjacent.prev);
  }, [previousQueueItem, openPicker, canChangeEpisode, goToEpisode, adjacent.prev]);

  return { hasNext, hasPrevious, playNext, playPrevious };
}
