import type { PlayerBridge } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type SleepMode =
  | { kind: "off" }
  | { kind: "minutes"; total: number; firesAt: number }
  | { kind: "end_episode" }
  | { kind: "end_next_episode"; remaining: number };

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
  const [mode, setMode] = useState<SleepMode>({ kind: "off" });
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const lastUrlRef = useRef(srcUrl);

  const set = useCallback((next: SleepMode) => {
    if (next.kind === "minutes") {
      setMode({ kind: "minutes", total: next.total, firesAt: Date.now() + next.total * 60_000 });
    } else if (next.kind === "end_next_episode") {
      setMode({ kind: "end_next_episode", remaining: 2 });
    } else {
      setMode(next);
    }
  }, []);

  const cancel = useCallback(() => {
    setMode({ kind: "off" });
    setRemainingMs(null);
  }, []);

  useEffect(() => {
    if (mode.kind !== "minutes") {
      setRemainingMs(null);
      return;
    }
    const tick = () => {
      const r = mode.firesAt - Date.now();
      setRemainingMs(Math.max(0, r));
      if (r <= 0) {
        bridgeRef.current?.pause();
        setMode({ kind: "off" });
        setRemainingMs(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [mode, bridgeRef]);

  useEffect(() => {
    if (mode.kind !== "end_episode" && mode.kind !== "end_next_episode") return;
    if (status !== "ended") return;
    if (durationSec <= 0) return;
    if (getPlaybackPosition() < durationSec - 2) return;
    if (mode.kind === "end_episode") {
      bridgeRef.current?.pause();
      setMode({ kind: "off" });
      return;
    }
    setMode((cur) =>
      cur.kind === "end_next_episode" && cur.remaining > 1
        ? { kind: "end_next_episode", remaining: cur.remaining - 1 }
        : { kind: "off" },
    );
    if (mode.remaining <= 1) bridgeRef.current?.pause();
  }, [status, durationSec, mode, bridgeRef]);

  useEffect(() => {
    if (lastUrlRef.current === srcUrl) return;
    lastUrlRef.current = srcUrl;
    if (mode.kind === "end_episode") {
      setMode({ kind: "off" });
      setRemainingMs(null);
    }
  }, [srcUrl, mode.kind]);

  return { mode, remainingMs, set, cancel };
}
