import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";
import { useEffect, useRef, type RefObject } from "react";

const POST_END_DELAY_MS = 800;
const LIVE_RELOAD_DELAY_MS = 1000;
const LIVE_RELOAD_WINDOW_MS = 15000;
const LIVE_RELOAD_MAX = 5;

export function useAutoEndExit(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  nextEp: PlayEpisode | null;
  canChangeEpisode: boolean;
  roomGuest: boolean;
  isLive: boolean;
  suspend: boolean;
  startedNearEndRef: RefObject<boolean>;
  reloadLive: () => void;
  closePlayer: () => void | Promise<void>;
}) {
  const {
    src,
    snap,
    nextEp,
    canChangeEpisode,
    roomGuest,
    isLive,
    suspend,
    startedNearEndRef,
    reloadLive,
    closePlayer,
  } = params;
  const firedForRef = useRef<string | null>(null);
  const reloadTimesRef = useRef<number[]>([]);

  useEffect(() => {
    firedForRef.current = null;
    reloadTimesRef.current = [];
  }, [src.url]);

  useEffect(() => {
    if (snap.durationSec <= 0) return;
    const pos = getPlaybackPosition();
    const naturalEnd = snap.status === "ended";
    const errorAtEnd = snap.errorCode != null && pos >= snap.durationSec - 2;
    const reachedEnd = snap.status !== "playing" && pos >= snap.durationSec - 1;
    if (!naturalEnd && !errorAtEnd && !reachedEnd) return;

    if (isLive) {
      if (!naturalEnd) return;
      const now = Date.now();
      const recent = reloadTimesRef.current.filter((t) => now - t < LIVE_RELOAD_WINDOW_MS);
      if (recent.length < LIVE_RELOAD_MAX) {
        recent.push(now);
        reloadTimesRef.current = recent;
        const t = window.setTimeout(reloadLive, LIVE_RELOAD_DELAY_MS);
        return () => window.clearTimeout(t);
      }
      reloadTimesRef.current = recent;
    }

    if (suspend) return;
    if (!isLive && startedNearEndRef.current) return;
    if ((canChangeEpisode || roomGuest) && nextEp) return;
    if (firedForRef.current === src.url) return;
    firedForRef.current = src.url;
    const t = window.setTimeout(() => {
      void closePlayer();
    }, POST_END_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [
    snap.status,
    snap.errorCode,
    snap.durationSec,
    nextEp,
    canChangeEpisode,
    roomGuest,
    isLive,
    suspend,
    reloadLive,
    src.url,
    closePlayer,
  ]);
}
