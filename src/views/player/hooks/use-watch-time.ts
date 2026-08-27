import { useEffect, useRef } from "react";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { addWatchTimeMs } from "@/lib/watch-time";

// Any jump larger than this between two clock ticks is a seek, not playback.
const MAX_STEP_SEC = 5;
const FLUSH_MS = 10000;

// Turns the playback clock into accumulated watch time. Only forward motion
// while the player reports "playing" counts; pauses, seeks, rewinds and
// buffering stalls contribute nothing.
export function useWatchTime(snap: PlayerSnapshot, srcKey: string): void {
  const statusRef = useRef(snap.status);
  statusRef.current = snap.status;
  const lastPosRef = useRef<number | null>(null);
  const pendingMsRef = useRef(0);

  useEffect(() => {
    lastPosRef.current = null;
  }, [srcKey]);

  useEffect(() => {
    const flush = () => {
      const ms = pendingMsRef.current;
      if (ms < 1000) return;
      pendingMsRef.current = 0;
      addWatchTimeMs(ms);
    };
    const unsub = subscribePlaybackClock(() => {
      const pos = getPlaybackPosition();
      const prev = lastPosRef.current;
      lastPosRef.current = pos;
      if (prev === null || statusRef.current !== "playing") return;
      const delta = pos - prev;
      if (delta <= 0 || delta > MAX_STEP_SEC) return;
      pendingMsRef.current += delta * 1000;
    });
    const timer = window.setInterval(flush, FLUSH_MS);
    return () => {
      unsub();
      window.clearInterval(timer);
      flush();
    };
  }, []);
}
