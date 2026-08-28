import type { TrackInfo } from "@/lib/player/bridge";
import {
  parseRelease,
  releaseAffinity,
  releaseCompatibilityPercent,
  subtitleConfidenceRank,
  type SubtitleMatchConfidence,
} from "@/lib/subtitles/release-match";
import { streamTagsOf, type StreamHints } from "@/lib/subtitles/stream-hints";

export type MatchVerdict = {
  track: TrackInfo;
  score: number;
  reasons: string[];
  sourceRank: 1 | 2 | 3;
  confidence: SubtitleMatchConfidence;
  compatibilityPercent?: number;
};

const SYNCED_SCORE = 10_000;

function isSyncedTrack(track: TrackInfo): boolean {
  return /^Synced \((?:SRT|VTT)\)/i.test(track.title ?? "");
}

function releaseEvidenceOf(track: TrackInfo): string {
  const release = track.release?.trim();
  if (release) return release;

  // Harbor-loaded tracks always carry an evaluated score/confidence. A neutral
  // result means the provider exposed no subtitle filename, so the visible
  // fallback title may describe the video and must not be scored as subtitle
  // release evidence. Imported/native tracks without stored analysis can still
  // use their real filename or label.
  if (track.matchScore != null || track.matchConfidence != null) return "";
  return `${track.title ?? ""} ${track.label ?? ""} ${track.externalFilename ?? ""}`;
}

function hasStoredReleaseEvidence(track: TrackInfo): boolean {
  const confidence = track.matchConfidence;
  const score = track.matchScore;
  if (confidence && confidence !== "low") return true;
  // A score of 2 is the deliberate neutral fallback when the video has a
  // known source but the subtitle exposes no release information.
  return score != null && score !== 0 && score !== 2;
}

function calibratedCompatibilityPercent(
  track: TrackInfo,
  videoResolution: string | null,
  confidence: SubtitleMatchConfidence,
  score: number,
): number {
  let percent = releaseCompatibilityPercent(confidence, score);
  const subtitleResolution = parseRelease(releaseEvidenceOf(track)).resolution;
  if (
    confidence !== "exact" &&
    videoResolution &&
    subtitleResolution &&
    videoResolution !== subtitleResolution
  ) {
    // Resolution alone does not decide timing, but an explicit mismatch means
    // the release is not proven close enough for a high-confidence percentage.
    percent = Math.min(percent, 74);
  }
  return percent;
}

export function rankByRelease(tracks: TrackInfo[], hints: StreamHints | null): MatchVerdict[] {
  const tags = hints ? streamTagsOf(hints) : null;
  return tracks
    .filter((track) => track.external === true)
    .map((track): MatchVerdict => {
      if (isSyncedTrack(track)) {
        return {
          track,
          score: SYNCED_SCORE,
          reasons: ["timing synchronized to this video"],
          sourceRank: 3,
          confidence: "exact",
          compatibilityPercent: 100,
        };
      }
      if (!tags) {
        const score = track.matchScore ?? 0;
        const confidence = track.matchConfidence ?? "low";
        const hasEvidence = hasStoredReleaseEvidence(track);
        return {
          track,
          score,
          reasons: track.matchReasons ?? [],
          sourceRank: 1,
          confidence,
          compatibilityPercent: hasEvidence
            ? releaseCompatibilityPercent(confidence, score)
            : undefined,
        };
      }
      const local = releaseAffinity(tags, releaseEvidenceOf(track));
      const useStoredEvidence = hasStoredReleaseEvidence(track);
      const hasExplicitMismatch = local.confidence === "incompatible";
      const effectiveScore =
        useStoredEvidence && !hasExplicitMismatch ? (track.matchScore ?? local.score) : local.score;
      const effectiveConfidence =
        useStoredEvidence && !hasExplicitMismatch
          ? (track.matchConfidence ?? local.confidence)
          : local.confidence;
      const hasEvidence = useStoredEvidence || local.reasons.length > 0;
      const reasons = Array.from(new Set([...local.reasons, ...(track.matchReasons ?? [])]));
      return {
        track,
        score: effectiveScore,
        reasons,
        sourceRank: local.sourceRank,
        confidence: effectiveConfidence,
        compatibilityPercent: hasEvidence
          ? calibratedCompatibilityPercent(
              track,
              tags.resolution,
              effectiveConfidence,
              effectiveScore,
            )
          : undefined,
      };
    })
    .sort(
      (a, b) =>
        subtitleConfidenceRank(b.confidence) - subtitleConfidenceRank(a.confidence) ||
        b.sourceRank - a.sourceRank ||
        b.score - a.score,
    );
}

export function pickBestMatch(pool: TrackInfo[], hints: StreamHints | null): MatchVerdict | null {
  const ranked = rankByRelease(pool, hints);
  const top = ranked[0];
  return top && subtitleConfidenceRank(top.confidence) >= 4 && top.score > 0 ? top : null;
}
