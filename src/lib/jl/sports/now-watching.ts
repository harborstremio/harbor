import { useSyncExternalStore } from "react";
import type { IptvChannel } from "@/lib/iptv/types";
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

/** Plays a channel for a game, remembering the game so the player can offer its live field. */
export function watchGameOn(
  channel: IptvChannel,
  game: SportsGame,
  play: (channel: IptvChannel) => void,
): void {
  setWatchingGame(channel.id, game);
  play(channel);
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
