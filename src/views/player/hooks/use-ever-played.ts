import type { PlayerStatus } from "@/lib/player/bridge";
import { getPlaybackPosition, usePlaybackFlag } from "@/lib/player/playback-clock";
import { useEffect, useRef, useState } from "react";

export function useEverPlayed(params: {
  url: string;
  status: PlayerStatus;
  durationSec: number;
  swappingEp: boolean;
  swapResolvingKey: string | null;
}) {
  const { url, status, durationSec, swappingEp, swapResolvingKey } = params;
  const [everPlayed, setEverPlayed] = useState(false);
  const hasProgress = usePlaybackFlag(() => getPlaybackPosition() > 0.3);

  useEffect(() => {
    if (everPlayed) return;
    if (durationSec > 0 && hasProgress) {
      setEverPlayed(true);
      return;
    }
    if (status === "playing" || status === "paused") {
      setEverPlayed(true);
    }
  }, [everPlayed, durationSec, hasProgress, status]);

  const lastUrlRef = useRef(url);
  useEffect(() => {
    if (lastUrlRef.current !== url) {
      lastUrlRef.current = url;
      setEverPlayed(false);
    }
  }, [url]);

  const loaderActive = swappingEp || swapResolvingKey != null || !everPlayed;

  return { everPlayed, loaderActive };
}
