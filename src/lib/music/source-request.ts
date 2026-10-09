import { useSyncExternalStore } from "react";
import { buildNowPlayingKey, nowPlayingMatches, parseNowPlayingKey } from "./now-playing-key";
import type { MusicTrack } from "./types";

const listeners = new Set<() => void>();
let pending: { owner: symbol; track: MusicTrack } | null = null;
const snapshot = () => pending?.track ?? null;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function beginMusicSourceRequest(track: MusicTrack): () => void {
  const owner = Symbol();
  pending = { owner, track };
  listeners.forEach(listener => listener());
  return () => {
    if (pending?.owner !== owner) return;
    pending = null;
    listeners.forEach(listener => listener());
  };
}
export const useMusicSourceRequest = () => useSyncExternalStore(subscribe, snapshot, snapshot);
export function musicSourceRequestMatches(pending: MusicTrack | null, track: MusicTrack): boolean {
  return !!pending && nowPlayingMatches(parseNowPlayingKey(buildNowPlayingKey(pending, "resolving")), track);
}
