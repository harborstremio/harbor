import { useSyncExternalStore } from "react";
import { getMusicState, subscribeMusic } from "./player";
import { buildNowPlayingKey, parseNowPlayingKey, type MusicNowPlaying } from "./now-playing-key";

function key(): string {
  const state = getMusicState();
  return buildNowPlayingKey(state.current, state.phase);
}

export function useMusicNowPlayingKey(): string {
  return useSyncExternalStore(subscribeMusic, key, key);
}

export function useMusicNowPlaying(): MusicNowPlaying {
  return parseNowPlayingKey(useMusicNowPlayingKey());
}
