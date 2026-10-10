import { buildNowPlayingKey, nowPlayingMatches, parseNowPlayingKey, type MusicNowPlaying } from "./now-playing-key";
import type { MusicTrack } from "./types";

/** Catalog identity survives resolution to a different playback provider. */
export function trackPlaybackState(now: MusicNowPlaying, pending: MusicTrack | null, track: MusicTrack | null) {
  const matches = nowPlayingMatches(now, track);
  const requesting = !!pending && nowPlayingMatches(parseNowPlayingKey(buildNowPlayingKey(pending, "resolving")), track);
  return {
    loading: requesting || (matches && now.phase === "resolving"),
    current: matches && ["resolving", "playing", "paused"].includes(now.phase),
    paused: matches && now.phase === "paused",
  };
}
