import { langScore } from "./language";
import { subtitleConfidenceRank, type SubtitleMatchConfidence } from "./release-match";

type SelectableSubtitleTrack = {
  id: string;
  lang?: string;
  default?: boolean;
  external?: boolean;
  title?: string;
  label?: string;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
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

export function pickDesiredSubtitleTrack<T extends SelectableSubtitleTrack>(
  tracks: T[],
  preferredLanguages: string[],
  preferEmbedded: boolean,
): T | null {
  const matching = tracks.filter(
    (track) => !isForcedTrack(track) && langScore(track.lang ?? "", preferredLanguages) >= 0,
  );
  if (matching.length === 0) return null;
  const eligible = matching.filter((track) => track.matchConfidence !== "incompatible");
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const languageDelta =
      langScore(b.lang ?? "", preferredLanguages) - langScore(a.lang ?? "", preferredLanguages);
    if (languageDelta !== 0) return languageDelta;
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
