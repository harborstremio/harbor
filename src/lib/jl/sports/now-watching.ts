import { useSyncExternalStore } from "react";
import type { SportsGame } from "@/lib/sports/espn";

/**
 * Which game a channel was opened for, set when a channel is picked from the Sports Hub's Watch
 * chooser. The player uses it to offer the live field. Kept for this session only.
 */
const byChannel = new Map<string, SportsGame>();
const listeners = new Set<() => void>();

export function setWatchingGame(channelId: string, game: SportsGame): void {
  byChannel.set(channelId, game);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useWatchingGame(channelId: string | null): SportsGame | null {
  return useSyncExternalStore(
    subscribe,
    () => (channelId ? (byChannel.get(channelId) ?? null) : null),
    () => null,
  );
}
