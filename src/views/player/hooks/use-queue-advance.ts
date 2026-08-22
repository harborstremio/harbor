import { useEffect, useRef, type RefObject } from "react";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";
import { getSleepAtEnd, queueCompleteCurrent, setSleepAtEnd, type QueueItem } from "@/lib/queue";

const STUB_MAX_SEC = 150;

export function useQueueAdvance(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  queue: QueueItem[];
  isLive: boolean;
  canAdvance: boolean;
  startedNearEndRef: RefObject<boolean>;
  openPicker: (
    meta: Meta,
    episode?: PlayEpisode,
    opts?: { autoPlay?: boolean; attempt?: number; intent?: "play" | "download"; resume?: boolean },
  ) => void;
  exitPlayer: () => void;
}) {
  const { src, snap, queue, isLive, canAdvance, startedNearEndRef, openPicker, exitPlayer } =
    params;
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    firedForRef.current = null;
  }, [src.url]);

  useEffect(() => {
    if (isLive || !canAdvance) return;
    if (snap.durationSec <= 0) return;
    if (snap.durationSec < STUB_MAX_SEC) return;
    if (startedNearEndRef.current) return;
    const pos = getPlaybackPosition();
    const naturalEnd = snap.status === "ended";
    const errorAtEnd = snap.errorCode != null && pos >= snap.durationSec - 2;
    const reachedEnd = snap.status !== "playing" && pos >= snap.durationSec - 1;
    if (!naturalEnd && !errorAtEnd && !reachedEnd) return;
    if (firedForRef.current === src.url) return;

    const nextItem = queueCompleteCurrent(src.meta, src.episode);
    if (nextItem) {
      firedForRef.current = src.url;
      openPicker(nextItem.meta, nextItem.episode, { autoPlay: true, resume: true });
      return;
    }
    if (getSleepAtEnd()) {
      firedForRef.current = src.url;
      setSleepAtEnd(false);
      exitPlayer();
    }
  }, [
    snap.status,
    snap.errorCode,
    snap.durationSec,
    src,
    isLive,
    canAdvance,
    queue,
    startedNearEndRef,
    openPicker,
    exitPlayer,
  ]);
}
