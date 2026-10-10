import { useEffect, useState, useSyncExternalStore } from "react";
import type { GameChannel } from "@/lib/jl/sports/channels";
import { msToTickerFlip, tickerOnAt, type TickerGame } from "@/lib/jl/sports/ticker";

export type ScoreTickerItem = TickerGame & { channels: GameChannel[] };

export type ScoreTickerState = {
  items: ScoreTickerItem[];
  /** Where the ticker may show right now. */
  bar: boolean;
  overlay: boolean;
  /** A live channel is playing, so the ticker skips its off minutes. */
  watchingLive: boolean;
  playingChannelId: string | null;
  showOdds: boolean;
  select: (item: ScoreTickerItem) => void;
};

/**
 * What the score ticker host (one per window, see score-ticker-host.tsx) publishes for every
 * ticker on screen: the bar across the top and the overlay on a full-screen live channel.
 */
let current: ScoreTickerState | null = null;
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function publishScoreTicker(next: ScoreTickerState | null): void {
  if (current === next) return;
  current = next;
  for (const fn of listeners) fn();
}

export function useScoreTicker(): ScoreTickerState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

const OFF_KEY = "jl.scoreTicker.off";
const dismissListeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

let dismissed = typeof window === "undefined" ? false : readDismissed();

/** ✕ turns the ticker off on this device; the "Scores" tab turns it back on. */
export function setTickerDismissed(value: boolean): void {
  try {
    if (value) localStorage.setItem(OFF_KEY, "1");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Private mode or blocked storage: the choice lasts for this session.
  }
  dismissed = value;
  for (const fn of dismissListeners) fn();
}

function subscribeDismissed(fn: () => void): () => void {
  dismissListeners.add(fn);
  return () => {
    dismissListeners.delete(fn);
  };
}

export function useTickerDismissed(): boolean {
  return useSyncExternalStore(
    subscribeDismissed,
    () => dismissed,
    () => false,
  );
}

/** Whether the ticker is in its "on" minutes; re-checked exactly when the schedule flips. */
export function useTickerOn(): boolean {
  const [on, setOn] = useState(() => tickerOnAt(Date.now()));
  useEffect(() => {
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      setOn(tickerOnAt(Date.now()));
      timer = window.setTimeout(arm, msToTickerFlip(Date.now()) + 50);
    };
    arm();
    // Hidden windows throttle timers; catch up as soon as the window shows again.
    const onVisible = () => {
      if (document.visibilityState === "visible") arm();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return on;
}
