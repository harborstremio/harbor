import { streamMatchDetail } from "./candidate-ranking";
import { releaseCompatibilityPercent } from "./release-match";
import type { StreamHints } from "./stream-hints";
import type { SubResult } from "./types";

export type SearchMatchDetails = {
  compatibilityPercent: number;
  providerReasons: string[];
  localReasons: string[];
  reasons: string[];
};

export function subtitleSearchMatchDetails(
  result: SubResult,
  hints: StreamHints | undefined,
): SearchMatchDetails {
  const local = streamMatchDetail(result, hints);
  const providerReasons = [...(result.providerMatch?.reasons ?? [])];
  if (providerReasons.length === 0 && result.providerMatch?.confidence) {
    providerReasons.push(`${result.providerMatch.confidence} provider match`);
  }
  const localReasons = local.reasons;
  return {
    compatibilityPercent: releaseCompatibilityPercent(local.confidence, local.score),
    providerReasons,
    localReasons,
    reasons: [
      ...providerReasons.map((reason) => `Provider: ${reason}`),
      ...localReasons.map((reason) => `Local: ${reason}`),
      "Timing: not tested",
    ],
  };
}
