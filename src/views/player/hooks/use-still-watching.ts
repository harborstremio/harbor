import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayEpisode } from "@/lib/view";

export function useStillWatching(params: {
  enabled: boolean;
  threshold: number;
  onContinue: (ep: PlayEpisode) => void;
  onStop: () => void;
}): {
  prompt: PlayEpisode | null;
  gateAdvance: (ep: PlayEpisode) => boolean;
  continueWatching: () => void;
  stopWatching: () => void;
} {
  const { enabled, threshold, onContinue, onStop } = params;
  const [prompt, setPrompt] = useState<PlayEpisode | null>(null);
  const runsRef = useRef(0);
  const onContinueRef = useRef(onContinue);
  const onStopRef = useRef(onStop);
  onContinueRef.current = onContinue;
  onStopRef.current = onStop;

  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      runsRef.current = 0;
    };
    window.addEventListener("pointerdown", reset, true);
    window.addEventListener("keydown", reset, true);
    return () => {
      window.removeEventListener("pointerdown", reset, true);
      window.removeEventListener("keydown", reset, true);
    };
  }, [enabled]);

  const gateAdvance = useCallback(
    (ep: PlayEpisode): boolean => {
      if (!enabled || threshold <= 0) return false;
      if (runsRef.current + 1 >= threshold) {
        setPrompt(ep);
        return true;
      }
      runsRef.current += 1;
      return false;
    },
    [enabled, threshold],
  );

  const continueWatching = useCallback(() => {
    runsRef.current = 0;
    setPrompt((ep) => {
      if (ep) onContinueRef.current(ep);
      return null;
    });
  }, []);

  const stopWatching = useCallback(() => {
    runsRef.current = 0;
    setPrompt(null);
    onStopRef.current();
  }, []);

  return { prompt, gateAdvance, continueWatching, stopWatching };
}
