import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { isLocalUrl } from "@/lib/player/local-url";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayerSrc } from "@/lib/view";
import { useEffect, useRef, type RefObject } from "react";

const WAKE_GAP_MS = 30_000;
const TICK_MS = 2_000;

export function useWakeReconnect(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
}) {
  const { bridgeRef, src, snap } = params;
  const srcRef = useRef(src);
  srcRef.current = src;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  useEffect(() => {
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const gap = now - last;
      last = now;
      if (gap < WAKE_GAP_MS) return;

      const s = srcRef.current;
      if (isLocalUrl(s.url)) return;
      const snap = snapRef.current;
      if (snap.status === "ended" || snap.status === "idle") return;
      if (snap.durationSec <= 0 && getPlaybackPosition() <= 0) return;
      const b = bridgeRef.current;
      if (!b) return;

      const pos = getPlaybackPosition();
      console.warn(`[player] system resumed after ${Math.round(gap / 1000)}s asleep — reconnecting stream`);
      void b.load({
        url: s.url,
        subtitles: s.subtitles,
        notWebReady: s.notWebReady,
        isLive: s.meta.id.startsWith("iptv:"),
        headers: s.headers,
        startAtSec: pos > 1 ? pos : undefined,
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [bridgeRef]);
}
