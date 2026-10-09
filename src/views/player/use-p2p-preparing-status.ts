import { useEffect, useRef, useState } from "react";
import { torrentEngineStats } from "@/lib/torrent/local-engine";
import { isLocalEngineUrl } from "@/lib/stremio-server";

export type P2pPreparingPhase = "searching" | "connected" | "slow" | "no-peers";

export type P2pPreparingStatus = {
  enabled: boolean;
  phase: P2pPreparingPhase;
  peers: number;
  downloadSpeed: number;
  retry: () => void;
};

const POLL_MS = 1000;
const NO_PEERS_MS = 75_000;
const SLOW_MS = 90_000;

export function useP2pPreparingStatus(params: {
  url: string;
  infoHash: string | null | undefined;
  fileIdx: number | null | undefined;
  active: boolean;
}): P2pPreparingStatus {
  const { url, infoHash, fileIdx, active } = params;
  const enabled = active && !!infoHash && isLocalEngineUrl(url);
  const [nonce, setNonce] = useState(0);
  const [phase, setPhase] = useState<P2pPreparingPhase>("searching");
  const [peers, setPeers] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const failedRef = useRef(false);
  const sawDataRef = useRef(false);

  useEffect(() => {
    if (!enabled || !infoHash) {
      setPhase("searching");
      setPeers(0);
      setDownloadSpeed(0);
      failedRef.current = false;
      sawDataRef.current = false;
      return;
    }
    const idx = typeof fileIdx === "number" && fileIdx >= 0 ? fileIdx : null;
    const startAt = Date.now();
    let cancelled = false;
    const tick = async () => {
      const s = await torrentEngineStats(infoHash, idx);
      if (cancelled) return;
      const p = s ? (s.unchoked > 0 ? s.unchoked : s.peers) : 0;
      const speed = s?.downloadSpeed ?? 0;
      const progress = s?.streamProgress ?? 0;
      if (speed > 0 || progress > 0) sawDataRef.current = true;
      setPeers(p);
      setDownloadSpeed(speed);
      if (failedRef.current) {
        setPhase("no-peers");
        return;
      }
      const idle = !sawDataRef.current && speed === 0 && progress === 0;
      const elapsed = Date.now() - startAt;
      if (idle && p === 0 && elapsed >= NO_PEERS_MS) {
        failedRef.current = true;
        setPhase("no-peers");
        return;
      }
      if (idle && p > 0 && elapsed >= SLOW_MS) {
        setPhase("slow");
        return;
      }
      setPhase(p > 0 ? "connected" : "searching");
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, url, infoHash, fileIdx, nonce]);

  return {
    enabled,
    phase,
    peers,
    downloadSpeed,
    retry: () => {
      failedRef.current = false;
      sawDataRef.current = false;
      setPhase("searching");
      setNonce((n) => n + 1);
    },
  };
}
