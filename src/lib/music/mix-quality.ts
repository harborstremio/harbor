import { backingTrackVersion } from "./source-version";
import { musicTrackIdentity } from "./track-identity";
import type { MusicTrack } from "./types";

/** Metadata search records are not a playable recommendation catalog. */
export function isMixRecording(track: MusicTrack): boolean {
  return !!track?.id?.trim() && !!track.title?.trim() && !!track.artist?.trim()
    && !!track.artwork?.trim() && Number.isFinite(track.durationSeconds) && track.durationSeconds > 0
    && !track.id.startsWith("musicbrainz:") && track.mediaKind !== "video" && !backingTrackVersion(track);
}

export function mixRecordings(tracks: readonly MusicTrack[]): MusicTrack[] {
  const seen = new Set<string>();
  return tracks.filter(track => {
    if (!isMixRecording(track)) return false;
    const key = musicTrackIdentity(track);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
