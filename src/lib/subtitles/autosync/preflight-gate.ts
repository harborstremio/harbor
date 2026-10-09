import type { TrackInfo } from "@/lib/player/bridge";
import { normalizeLang } from "@/lib/subtitles/language";

type PreflightTrack = Pick<TrackInfo, "external" | "lang" | "prepared" | "timingStatus">;

export function hasNaturallyAlignedPreparedCandidate(
  tracks: readonly PreflightTrack[],
  selectedLanguage?: string | null,
): boolean {
  const selected = normalizeLang(selectedLanguage ?? "").split("-")[0];
  if (!selected) return false;
  return tracks.some(
    (track) =>
      track.external === true &&
      track.prepared === true &&
      track.timingStatus === "aligned" &&
      normalizeLang(track.lang ?? "").split("-")[0] === selected,
  );
}

export function automaticAutoSyncMayStart(input: {
  preflightSettled: boolean;
  tracks: readonly PreflightTrack[];
  selectedLanguage?: string | null;
}): boolean {
  return (
    input.preflightSettled &&
    !hasNaturallyAlignedPreparedCandidate(input.tracks, input.selectedLanguage)
  );
}
