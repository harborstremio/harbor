import { isBundledEngineUrl, isLocalEngineUrl } from "@/lib/stremio-server";
import {
  fetchEngineStats,
  GENUINE_FAILURE_WINDOW_MS,
  COLD_CONNECT_DEADLINE_MS,
  ENGINE_DOWN_STRIKES,
  type EngineStats,
} from "@/lib/torrent/engine-stats";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 2000;
const GROWTH_THRESHOLD = 64 * 1024;

export function useEngineStats(args: {
  url: string;
  infoHash: string | null;
  fileIdx: number | null;
  active: boolean;
}): { stats: EngineStats | null; genuineFailure: boolean } {
  const { url, infoHash, fileIdx, active } = args;
  const enabled = active && (isBundledEngineUrl(url) || isLocalEngineUrl(url)) && !!infoHash;
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [genuineFailure, setGenuineFailure] = useState(false);
  const prevRef = useRef<EngineStats | null>(null);
  const lastGrowthRef = useRef(0);
  const lastGrowthAtRef = useRef(0);
  const firstPeerSeenAtRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const downStrikesRef = useRef(0);

  useEffect(() => {
    setStats(null);
    setGenuineFailure(false);
    prevRef.current = null;
    lastGrowthRef.current = 0;
    lastGrowthAtRef.current = 0;
    firstPeerSeenAtRef.current = null;
    startedAtRef.current = Date.now();
    downStrikesRef.current = 0;
    if (!enabled || infoHash == null) return;
    const idx = fileIdx == null || fileIdx < 0 ? -1 : fileIdx;
    const ac = new AbortController();
    let cancelled = false;

    const tick = async () => {
      const res = await fetchEngineStats(infoHash, idx, prevRef.current, ac.signal, url);
      if (cancelled) return;
      const now = Date.now();

      if (res.kind === "down") {
        downStrikesRef.current += 1;
        if (downStrikesRef.current >= ENGINE_DOWN_STRIKES && !prevRef.current?.sawData) {
          setGenuineFailure(true);
        }
        return;
      }
      downStrikesRef.current = 0;
      if (res.kind === "empty") {
        setGenuineFailure(false);
        return;
      }

      const next = res.stats;
      prevRef.current = next;
      setStats(next);

      if ((next.peers > 0 || next.unchoked > 0) && firstPeerSeenAtRef.current == null) {
        firstPeerSeenAtRef.current = now;
      }
      if (next.downloaded > lastGrowthRef.current + GROWTH_THRESHOLD) {
        lastGrowthRef.current = next.downloaded;
        lastGrowthAtRef.current = now;
        setGenuineFailure(false);
        return;
      }

      const moving = next.unchoked > 0 || next.downloadSpeed > 0 || next.peerSearchRunning;
      if (moving) {
        setGenuineFailure(false);
        return;
      }

      if (!next.sawData) return;

      if (firstPeerSeenAtRef.current == null) {
        if (next.peers === 0 && now - startedAtRef.current > COLD_CONNECT_DEADLINE_MS) {
          setGenuineFailure(true);
        }
        return;
      }

      const anchor = Math.max(firstPeerSeenAtRef.current, lastGrowthAtRef.current);
      if (next.peers === 0 && now - anchor > GENUINE_FAILURE_WINDOW_MS) {
        setGenuineFailure(true);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      ac.abort();
      window.clearInterval(id);
    };
  }, [enabled, url, infoHash, fileIdx]);

  return { stats, genuineFailure };
}
