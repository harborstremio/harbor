import type { DebridStore } from "@/lib/debrid/types";
import { hasUncachedMarker } from "@/lib/streams/cached";
import { filterStreamsByMode, hasDirectMediaEvidence } from "@/lib/streams/mode";
import type { Resolution, ScoredStream } from "@/lib/streams/types";

export type DownloadSourcePolicy = {
  maxHeight: number | null;
  streamMode: string | null | undefined;
  debrids: DebridStore[];
  allowP2p: boolean;
};

export type DownloadSourceCandidates = {
  ready: ScoredStream[];
  p2p: ScoredStream[];
};

const HEIGHT: Record<Resolution, number> = {
  "4K": 2160,
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
  SD: 480,
};

const MIN_FILE_BYTES = 10 * 1024 * 1024;

function passesMaxHeight(stream: ScoredStream, maxHeight: number | null): boolean {
  if (maxHeight == null) return true;
  const height = HEIGHT[stream.resolution];
  return height != null && height <= maxHeight;
}

function isStub(stream: ScoredStream): boolean {
  const filename = stream.behaviorHints?.filename ?? stream.behaviorHints?.fileName ?? "";
  if (/\bsample\b/i.test(filename)) return true;
  return stream.size != null && stream.size < MIN_FILE_BYTES;
}

function isReadyWithoutP2p(stream: ScoredStream, debrids: DebridStore[]): boolean {
  const directUrl =
    Boolean(stream.url && stream.url !== "#" && !hasUncachedMarker(stream)) &&
    hasDirectMediaEvidence(stream);
  return (
    directUrl ||
    debrids.some((debrid) => stream.cached[debrid.slug] || stream.inLibrary[debrid.slug])
  );
}

export function prepareDownloadSourceCandidates(
  streams: ScoredStream[],
  policy: DownloadSourcePolicy,
): DownloadSourceCandidates {
  // Preserve the pipeline's ranking and addon order through all filtering.
  const candidates = filterStreamsByMode(streams, policy.streamMode).filter(
    (stream) => passesMaxHeight(stream, policy.maxHeight) && !isStub(stream),
  );
  return {
    ready: candidates.filter((stream) => isReadyWithoutP2p(stream, policy.debrids)),
    p2p: policy.allowP2p
      ? candidates.filter(
          (stream) => Boolean(stream.infoHash) && !isReadyWithoutP2p(stream, policy.debrids),
        )
      : [],
  };
}
