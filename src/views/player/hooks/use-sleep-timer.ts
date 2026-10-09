import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import {
  clearSleepMode,
  getSleepMode,
  registerSleepFireHandler,
  setSleepMode,
  useSleepMode,
  useSleepRemainingMs,
  type SleepMode,
} from "@/lib/sleep-timer-store";

export type { SleepMode } from "@/lib/sleep-timer-store";

export type SleepTimerState = {
  mode: SleepMode;
  remainingMs: number | null;
  set: (m: SleepMode) => void;
  cancel: () => void;
};

export const SLEEP_PRESETS: Array<{ id: string; label: string; mode: SleepMode }> = [
  { id: "15", label: "15 min", mode: { kind: "minutes", total: 15, firesAt: 0 } },
  { id: "30", label: "30 min", mode: { kind: "minutes", total: 30, firesAt: 0 } },
  { id: "45", label: "45 min", mode: { kind: "minutes", total: 45, firesAt: 0 } },
  { id: "60", label: "1 hour", mode: { kind: "minutes", total: 60, firesAt: 0 } },
  { id: "120", label: "2 hours", mode: { kind: "minutes", total: 120, firesAt: 0 } },
  { id: "180", label: "3 hours", mode: { kind: "minutes", total: 180, firesAt: 0 } },
  { id: "240", label: "4 hours", mode: { kind: "minutes", total: 240, firesAt: 0 } },
  { id: "360", label: "6 hours", mode: { kind: "minutes", total: 360, firesAt: 0 } },
  { id: "ep", label: "End of episode", mode: { kind: "end_episode" } },
  { id: "ep2", label: "End of next episode", mode: { kind: "end_next_episode", remaining: 2 } },
];

export function useSleepTimer(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  status: string;
  durationSec: number;
  srcUrl: string;
}): SleepTimerState {
  const { bridgeRef, status, durationSec, srcUrl } = params;
  const mode = useSleepMode();
  const remainingMs = useSleepRemainingMs();
  const lastUrlRef = useRef(srcUrl);

  useEffect(() => {
    registerSleepFireHandler(() => bridgeRef.current?.pause());
    return () => registerSleepFireHandler(null);
  }, [bridgeRef]);

  const set = useCallback((next: SleepMode) => {
    setSleepMode(next);
  }, []);

  const cancel = useCallback(() => {
    clearSleepMode();
  }, []);

  useEffect(() => {
    if (mode.kind !== "end_episode" && mode.kind !== "end_next_episode") return;
    if (status !== "ended") return;
    if (durationSec <= 0) return;
    if (getPlaybackPosition() < durationSec - 2) return;
    if (mode.kind === "end_episode") {
      bridgeRef.current?.pause();
      clearSleepMode();
      return;
    }
    const cur = getSleepMode();
    if (cur.kind === "end_next_episode" && cur.remaining > 1) {
      setSleepMode({ kind: "end_next_episode", remaining: cur.remaining - 1 });
    } else {
      clearSleepMode();
    }
    if (mode.remaining <= 1) bridgeRef.current?.pause();
  }, [status, durationSec, mode, bridgeRef]);

  useEffect(() => {
    if (lastUrlRef.current === srcUrl) return;
    lastUrlRef.current = srcUrl;
    if (getSleepMode().kind === "end_episode") clearSleepMode();
  }, [srcUrl]);

  return { mode, remainingMs, set, cancel };
}
