import { useEffect, useRef, useState } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";

export function useDockAudio(bridge: PlayerBridge | null, snap: PlayerSnapshot) {
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [muteDraft, setMuteDraft] = useState<boolean | null>(null);
  const muteIntent = useRef<boolean | null>(null);
  const volumeIntent = useRef<number | null>(null);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeSettle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muteSettle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest gesture visible while delayed native acknowledgements settle.
  useEffect(() => {
    setVolumeDraft(null);
    setMuteDraft(null);
    muteIntent.current = null;
    return () => {
      if (volumeTimer.current) clearTimeout(volumeTimer.current);
      if (volumeSettle.current) clearTimeout(volumeSettle.current);
      if (muteSettle.current) clearTimeout(muteSettle.current);
      volumeTimer.current = null;
      volumeIntent.current = null;
    };
  }, [bridge]);

  const changeVolume = (value: number) => {
    const next = Math.min(1, Math.max(0, value));
    setVolumeDraft(next);
    volumeIntent.current = next;
    if (!volumeTimer.current) {
      bridge?.setVolume(next);
      volumeIntent.current = null;
      volumeTimer.current = setTimeout(() => {
        volumeTimer.current = null;
        if (volumeIntent.current !== null) bridge?.setVolume(volumeIntent.current);
        volumeIntent.current = null;
      }, 40);
    }
    if (volumeSettle.current) clearTimeout(volumeSettle.current);
    volumeSettle.current = setTimeout(() => setVolumeDraft(null), 1200);
  };
  const toggleMute = () => {
    const next = !(muteIntent.current ?? snap.muted);
    muteIntent.current = next;
    setMuteDraft(next);
    bridge?.setMuted(next);
    if (muteSettle.current) clearTimeout(muteSettle.current);
    muteSettle.current = setTimeout(() => {
      setMuteDraft(null);
      muteIntent.current = null;
    }, 1200);
  };
  return {
    volume: volumeDraft ?? snap.volume,
    muted: muteDraft ?? snap.muted,
    changeVolume,
    toggleMute,
  };
}
