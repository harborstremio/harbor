import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  clearStillWatchingState,
  getStillWatchingState,
  initialStillWatchingState,
  requestStillWatchingAdvance,
  resetStillWatchingRun,
  resolveStillWatchingPrompt,
  setStillWatchingState,
  subscribeStillWatchingState,
} from "@/lib/still-watching";
import type { PlayEpisode } from "@/lib/view";

export function useStillWatching(params: {
  storeKey: string;
  enabled: boolean;
  threshold: number;
  onContinue: (episode: PlayEpisode) => void;
  onStop: () => void;
}) {
  const { storeKey, enabled, threshold, onContinue, onStop } = params;
  const subscribe = useCallback(
    (listener: () => void) => subscribeStillWatchingState(storeKey, listener),
    [storeKey],
  );
  const getSnapshot = useCallback(() => getStillWatchingState<PlayEpisode>(storeKey), [storeKey]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const resetStillWatching = useCallback(() => {
    if (!enabled) return;
    setStillWatchingState(
      storeKey,
      resetStillWatchingRun(getStillWatchingState<PlayEpisode>(storeKey)),
    );
  }, [enabled, storeKey]);

  useEffect(() => {
    if (!enabled) {
      clearStillWatchingState(storeKey);
      return;
    }
    window.addEventListener("pointerdown", resetStillWatching, true);
    window.addEventListener("keydown", resetStillWatching, true);
    return () => {
      window.removeEventListener("pointerdown", resetStillWatching, true);
      window.removeEventListener("keydown", resetStillWatching, true);
    };
  }, [enabled, resetStillWatching, storeKey]);

  const gateAdvance = useCallback(
    (episode: PlayEpisode): boolean => {
      const result = requestStillWatchingAdvance(
        getStillWatchingState<PlayEpisode>(storeKey),
        episode,
        enabled,
        threshold,
      );
      setStillWatchingState(storeKey, result.state);
      return result.held;
    },
    [enabled, storeKey, threshold],
  );

  const continueWatching = useCallback(() => {
    const resolved = resolveStillWatchingPrompt(getStillWatchingState<PlayEpisode>(storeKey));
    setStillWatchingState(storeKey, resolved.state);
    if (resolved.pending) onContinue(resolved.pending);
  }, [onContinue, storeKey]);

  const stopWatching = useCallback(() => {
    setStillWatchingState(storeKey, initialStillWatchingState<PlayEpisode>());
    onStop();
  }, [onStop, storeKey]);

  return {
    prompt: enabled ? state.pending : null,
    gateAdvance,
    continueWatching,
    stopWatching,
    resetStillWatching,
  };
}
