import { langScore, normalizeLang } from "./language";
import {
  releaseAffinity,
  subtitleConfidenceRank,
  type SubtitleMatchConfidence,
} from "./release-match";
import { streamTagsOf, type StreamHints } from "./stream-hints";
import type { SubResult } from "./types";

export function subtitleText(result: SubResult): string {
  return `${result.release ?? ""} ${result.title ?? ""} ${result.url ?? ""}`;
}

export function streamMatchDetail(
  result: SubResult,
  hints: StreamHints | undefined,
): {
  score: number;
  reasons: string[];
  sourceRank: 1 | 2 | 3;
  exactHash: boolean;
  confidence: SubtitleMatchConfidence;
} {
  if (!hints) {
    return { score: 0, reasons: [], sourceRank: 1, exactHash: false, confidence: "low" };
  }
  const { score, reasons, sourceRank, confidence } = releaseAffinity(
    streamTagsOf(hints),
    subtitleText(result),
  );
  let total = score;
  const out = [...reasons];
  const exactHash = result.hash === "moviehash";
  if (exactHash) {
    total += 200;
    out.unshift("exact file match");
  }
  if (result.hearingImpaired && !hints.preferHearingImpaired) total -= 25;
  return {
    score: total,
    reasons: out,
    sourceRank,
    exactHash,
    confidence: exactHash ? "exact" : confidence,
  };
}

export function streamMatchScore(result: SubResult, hints: StreamHints | undefined): number {
  return streamMatchDetail(result, hints).score;
}

export function compareSubtitleMatch(
  a: SubResult,
  b: SubResult,
  hints: StreamHints | undefined,
): number {
  const aMatch = streamMatchDetail(a, hints);
  const bMatch = streamMatchDetail(b, hints);
  if (aMatch.exactHash !== bMatch.exactHash) return aMatch.exactHash ? -1 : 1;
  const confidence =
    subtitleConfidenceRank(bMatch.confidence) - subtitleConfidenceRank(aMatch.confidence);
  if (confidence !== 0) return confidence;
  if (aMatch.sourceRank !== bMatch.sourceRank) return bMatch.sourceRank - aMatch.sourceRank;
  if (aMatch.score !== bMatch.score) return bMatch.score - aMatch.score;
  const downloads = (b.downloads ?? 0) - (a.downloads ?? 0);
  if (downloads !== 0) return downloads;
  return (a.title || "").localeCompare(b.title || "");
}

function strongProviderConfidenceRank(result: SubResult): number {
  switch (result.providerMatch?.confidence) {
    case "exact":
      return 2;
    case "high":
      return 1;
    default:
      return 0;
  }
}

function weakProviderConfidenceRank(result: SubResult): number {
  switch (result.providerMatch?.confidence) {
    case "medium":
      return 3;
    case "low":
      return 2;
    case "unknown":
      return 1;
    default:
      return 0;
  }
}

function timingRank(result: SubResult): number {
  switch (result.timingStatus) {
    case "aligned":
      return 4;
    case "fixed-offset":
      return 3;
    case "drifting":
      return 2;
    case "unmeasurable":
      return 1;
    default:
      return 0;
  }
}

function providerScore(result: SubResult): number {
  const score = result.providerMatch?.score;
  if (score == null || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score > 1 ? score / 100 : score));
}

function explicitEpisodeMismatch(result: SubResult, hints: StreamHints | undefined): boolean {
  if (!hints) return false;
  if (result.season != null && hints.season != null && result.season !== hints.season) return true;
  if (result.episode != null && hints.episode != null && result.episode !== hints.episode)
    return true;
  return false;
}

function explicitEpisodeRank(result: SubResult, hints: StreamHints | undefined): number {
  if (!hints) return 0;
  let rank = 0;
  if (result.season != null && hints.season != null && result.season === hints.season) rank += 1;
  if (result.episode != null && hints.episode != null && result.episode === hints.episode)
    rank += 2;
  if (result.episodeConfirmed) rank += 2;
  return rank;
}

function stableCandidateKey(result: SubResult): string {
  return [
    result.source,
    result.id,
    normalizeLang(result.lang),
    result.url,
    result.release ?? "",
    result.rawFilename ?? "",
  ]
    .join("|")
    .toLowerCase();
}

export function stableTextCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Global auto-selection order. Menu presentation deliberately uses a separate interleaver. */
export function rankSubtitleCandidates(
  results: SubResult[],
  preferredLangs: string[],
  hints?: StreamHints,
): SubResult[] {
  return results
    .filter((result) => preferredLangs.length === 0 || langScore(result.lang, preferredLangs) >= 0)
    .filter((result) => !result.forced && !result.foreignOnly)
    .filter((result) => !explicitEpisodeMismatch(result, hints))
    .filter((result) => streamMatchDetail(result, hints).confidence !== "incompatible")
    .slice()
    .sort((a, b) => {
      const movieHash = Number(b.hash === "moviehash") - Number(a.hash === "moviehash");
      if (movieHash !== 0) return movieHash;

      const language = langScore(b.lang, preferredLangs) - langScore(a.lang, preferredLangs);
      if (language !== 0) return language;

      const strongProvider = strongProviderConfidenceRank(b) - strongProviderConfidenceRank(a);
      if (strongProvider !== 0) return strongProvider;
      if (strongProviderConfidenceRank(a) > 0) {
        const providerMatchScore = providerScore(b) - providerScore(a);
        if (providerMatchScore !== 0) return providerMatchScore;
      }

      const episode = explicitEpisodeRank(b, hints) - explicitEpisodeRank(a, hints);
      if (episode !== 0) return episode;

      const aMatch = streamMatchDetail(a, hints);
      const bMatch = streamMatchDetail(b, hints);
      const localConfidence =
        subtitleConfidenceRank(bMatch.confidence) - subtitleConfidenceRank(aMatch.confidence);
      if (localConfidence !== 0) return localConfidence;
      if (aMatch.sourceRank !== bMatch.sourceRank) return bMatch.sourceRank - aMatch.sourceRank;
      if (aMatch.score !== bMatch.score) return bMatch.score - aMatch.score;

      const timing = timingRank(b) - timingRank(a);
      if (timing !== 0) return timing;

      const weakProvider = weakProviderConfidenceRank(b) - weakProviderConfidenceRank(a);
      if (weakProvider !== 0) return weakProvider;
      const providerMatchScore = providerScore(b) - providerScore(a);
      if (providerMatchScore !== 0) return providerMatchScore;

      const machine = Number(a.machineTranslated === true) - Number(b.machineTranslated === true);
      if (machine !== 0) return machine;
      const trusted = Number(b.fromTrusted === true) - Number(a.fromTrusted === true);
      if (trusted !== 0) return trusted;
      const rating = (b.rating?.score ?? 0) - (a.rating?.score ?? 0);
      if (rating !== 0) return rating;
      const ratingCount = (b.rating?.total ?? 0) - (a.rating?.total ?? 0);
      if (ratingCount !== 0) return ratingCount;
      const downloads = (b.downloads ?? 0) - (a.downloads ?? 0);
      if (downloads !== 0) return downloads;
      return stableTextCompare(stableCandidateKey(a), stableCandidateKey(b));
    });
}
