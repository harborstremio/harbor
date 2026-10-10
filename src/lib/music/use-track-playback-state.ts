import { useMusicNowPlaying } from "./use-now-playing";
import { useMusicSourceRequest } from "./source-request";
import { trackPlaybackState } from "./track-playback-state";
import type { MusicTrack } from "./types";

export function useTrackPlaybackState(track: MusicTrack | null) {
  return trackPlaybackState(useMusicNowPlaying(), useMusicSourceRequest(), track);
}
