import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useEffect, useRef } from "react";

const NEAR_END_RATIO = 0.8;

export function useStartedNearEnd(srcUrl: string, status: string, durationSec: number) {
  const startedNearEndRef = useRef(false);
  const capturedRef = useRef(false);
  const durationRef = useRef(durationSec);
  durationRef.current = durationSec;
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    startedNearEndRef.current = false;
    capturedRef.current = false;
  }, [srcUrl]);

  useEffect(() => {
    return subscribePlaybackClock(() => {
      if (capturedRef.current) return;
      if (statusRef.current !== "playing") return;
      const dur = durationRef.current;
      if (dur <= 0) return;
      const pos = getPlaybackPosition();
      if (pos <= 0) return;
      capturedRef.current = true;
      startedNearEndRef.current = pos / dur >= NEAR_END_RATIO;
    });
  }, []);

  return startedNearEndRef;
}
