import { langScore } from "./language";
import { subtitleConfidenceRank, type SubtitleMatchConfidence } from "./release-match";
import type { SubtitleTimingStatus } from "./candidate-preflight";

type SelectableSubtitleTrack = {
  id: string;
  lang?: string;
  default?: boolean;
  external?: boolean;
  prepared?: boolean;
  autoSelectionEligible?: boolean;
  forced?: boolean;
  foreignOnly?: boolean;
  title?: string;
  label?: string;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  timingStatus?: SubtitleTimingStatus;
};

function isForcedTrack(track: SelectableSubtitleTrack): boolean {
  return /\bforced\b/i.test(`${track.title ?? ""} ${track.label ?? ""}`);
}

function sourceRank(track: SelectableSubtitleTrack, preferEmbedded: boolean): number {
  if (!track.external) return preferEmbedded ? 3 : 0;
  const text = `${track.title ?? ""} ${track.label ?? ""}`.toLowerCase();
  return text.includes("opensubtitles") ? 1 : 2;
}

function confidenceRank(track: SelectableSubtitleTrack, preferEmbedded: boolean): number {
  if (!track.external) return preferEmbedded ? 4 : 3;
  return subtitleConfidenceRank(track.matchConfidence ?? "low");
}

export function isAutoSelectableSubtitleTrack(track: SelectableSubtitleTrack): boolean {
  return (
    (!track.external || (track.prepared === true && track.autoSelectionEligible === true)) &&
    track.timingStatus !== "different-cut" &&
    track.timingStatus !== "invalid" &&
    track.matchConfidence !== "incompatible"
  );
}

export function subtitleAutoSelectionSignature(
  tracks: readonly Pick<SelectableSubtitleTrack, "id" | "prepared" | "autoSelectionEligible">[],
): string {
  return tracks
    .map(
      (track) =>
        `${track.id}:${track.prepared === true ? 1 : 0}:${track.autoSelectionEligible === true ? 1 : 0}`,
    )
    .join(",");
}

export function pickDesiredSubtitleTrack<T extends SelectableSubtitleTrack>(
  tracks: T[],
  preferredLanguages: string[],
  preferEmbedded: boolean,
): T | null {
  const eligible = tracks.filter(
    (track) =>
      track.forced !== true &&
      track.foreignOnly !== true &&
      !isForcedTrack(track) &&
      isAutoSelectableSubtitleTrack(track) &&
      langScore(track.lang ?? "", preferredLanguages) >= 0,
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const languageDelta =
      langScore(b.lang ?? "", preferredLanguages) - langScore(a.lang ?? "", preferredLanguages);
    if (languageDelta !== 0) return languageDelta;
    const timingDelta = Number(b.timingStatus === "aligned") - Number(a.timingStatus === "aligned");
    if (timingDelta !== 0) return timingDelta;
    const confidenceDelta = confidenceRank(b, preferEmbedded) - confidenceRank(a, preferEmbedded);
    if (confidenceDelta !== 0) return confidenceDelta;
    const matchDelta = (b.matchScore ?? 0) - (a.matchScore ?? 0);
    if (matchDelta !== 0) return matchDelta;
    const sourceDelta = sourceRank(b, preferEmbedded) - sourceRank(a, preferEmbedded);
    if (sourceDelta !== 0) return sourceDelta;
    return Number(b.default === true) - Number(a.default === true);
  });
  return eligible[0];
}
