import { useEffect, useState } from "react";
import type { MusicTrack } from "./types";
import { loadRecordingProfile, type RecordingProfile } from "./recording-profile";

export function useRecordingProfile(track: MusicTrack | null | undefined, active = true) {
  const key = track ? `${track.connectorId}:${track.id}:${track.artist}:${track.title}` : "";
  const [result, setResult] = useState<{ key: string; profile: RecordingProfile | null } | null>(
    null,
  );
  useEffect(() => {
    if (!active || !track) return;
    const controller = new AbortController();
    void loadRecordingProfile(track, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted) setResult({ key, profile });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, profile: null });
      });
    return () => controller.abort();
  }, [key, active]);
  const profile = result?.key === key ? result.profile : null;
  // The catalog describes this recording; it never replaces the playing provider identity.
  const display =
    track && profile
      ? {
          ...track,
          title: profile.catalogTrack.title,
          artist: profile.catalogTrack.artist,
          album: profile.album.title,
          artwork: profile.album.artwork || profile.catalogTrack.artwork || track.artwork,
        }
      : track;
  return { profile, display };
}
