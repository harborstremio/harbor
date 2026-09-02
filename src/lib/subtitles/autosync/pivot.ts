import type { SyncTransform } from "./fp-gate";
import { stableTextCompare } from "@/lib/subtitles/candidate-ranking";
import {
  applyTimeTransform,
  fitPreferredTimeTransform,
  type PreferredFitResult,
  type TimeAnchor,
} from "./alignment-fit";
import {
  alignCuesMonotonically,
  type MonotonicAlignmentResult,
  type StructuralCue,
} from "./monotonic-align";

export type PivotCandidate = {
  id: string;
  language: string;
  exactRelease: boolean;
  releaseScore: number;
  wrongEditionRisk?: number;
  popularity?: number;
  source?: string;
};

export type PreparedPivotCandidate = {
  cues: StructuralCue[];
  healthy: boolean;
  formatSafe: boolean;
  diagnostics?: string[];
};

export type PivotAudioValidation = {
  validated: boolean;
  transform: SyncTransform;
  score: number;
  coverage: number;
  wrongCut?: boolean;
  diagnostics?: string[];
};

export type TargetAudioValidation = {
  qualityBefore: number;
  qualityAfter: number;
  coverage: number;
  heldOutAudioMeasured: boolean;
  wrongCut?: boolean;
};

export type PivotHeldOutWindow = {
  sourceSec: number;
  expectedTargetSec: number;
  fromSec: number;
  toSec: number;
};

export type PivotWorkflowPorts = {
  searchPivotCandidates: (audioLanguage: string) => Promise<PivotCandidate[]>;
  preparePivotCandidate: (candidate: PivotCandidate) => Promise<PreparedPivotCandidate>;
  validatePivotAgainstAudio: (
    candidate: PivotCandidate,
    prepared: PreparedPivotCandidate,
  ) => Promise<PivotAudioValidation>;
  validateTargetAgainstAudio?: (
    targetCues: readonly StructuralCue[],
    transform: SyncTransform,
    heldOutWindows: readonly PivotHeldOutWindow[],
  ) => Promise<TargetAudioValidation>;
};

export type PivotWorkflowInput = {
  audioLanguage: string;
  subtitleLanguage: string;
  targetCues: readonly StructuralCue[];
  targetHealthy: boolean;
  targetFormatSafe: boolean;
  calibrationReady: boolean;
  maxCandidates?: number;
  bestEffort?: boolean;
};

export type PivotGateEvidence = {
  pivotAudioValidated: boolean;
  pivotAudioScore: number;
  pivotAudioCoverage: number;
  pivotWrongCut?: boolean;
  pivotHealthy: boolean;
  targetHealthy: boolean;
  formatSafe: boolean;
  anchorCount: number;
  targetCoverage: number;
  regionCoverage: { beginning: number; middle: number; end: number };
  heldOutCount: number;
  heldOutMedianResidualSec?: number;
  qualityBefore?: number;
  qualityAfter?: number;
  finalCoverage?: number;
  heldOutAudioMeasured: boolean;
  finalWrongCut?: boolean;
  releaseAgreement: boolean;
  independentEvidenceGroups: number;
  calibrationReady: boolean;
  bestEffort: boolean;
};

export type PivotGateDecision = {
  decision: "refuse" | "offer" | "apply";
  bindingRule: string;
  reason: string;
};

export type PivotAttempt = {
  candidate: PivotCandidate;
  decision: PivotGateDecision;
  evidence?: PivotGateEvidence;
  alignment?: MonotonicAlignmentResult;
  fit?: PreferredFitResult;
  diagnostics: string[];
};

export type PivotWorkflowResult = {
  decision: PivotGateDecision;
  candidate?: PivotCandidate;
  transform?: SyncTransform;
  alignment?: MonotonicAlignmentResult;
  fit?: PreferredFitResult;
  evidence?: PivotGateEvidence;
  attempts: PivotAttempt[];
};

const REFUSE_NO_PIVOT: PivotGateDecision = {
  decision: "refuse",
  bindingRule: "pivot-unavailable",
  reason: "No safe audio-language pivot subtitle was available.",
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeLanguage(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/_/gu, "-");
  const base = normalized.split("-")[0];
  if (base === "eng") return "en";
  if (base === "ara") return "ar";
  if (base === "jpn") return "ja";
  return base;
}

export function rankPivotCandidates(
  candidates: readonly PivotCandidate[],
  audioLanguage: string,
): PivotCandidate[] {
  const wanted = normalizeLanguage(audioLanguage);
  return candidates
    .filter((candidate) => normalizeLanguage(candidate.language) === wanted)
    .map((candidate) => ({
      ...candidate,
      releaseScore: clamp01(candidate.releaseScore),
      wrongEditionRisk: clamp01(candidate.wrongEditionRisk ?? 0),
      popularity: Math.max(0, candidate.popularity ?? 0),
    }))
    .sort(
      (left, right) =>
        Number(right.exactRelease) - Number(left.exactRelease) ||
        right.releaseScore - left.releaseScore ||
        (left.wrongEditionRisk ?? 0) - (right.wrongEditionRisk ?? 0) ||
        (right.popularity ?? 0) - (left.popularity ?? 0) ||
        stableTextCompare(left.id, right.id),
    );
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function splitTrainingAndHeldOut(anchors: readonly TimeAnchor[]): {
  training: TimeAnchor[];
  heldOut: TimeAnchor[];
} {
  if (anchors.length < 8) return { training: [...anchors], heldOut: [] };
  const training: TimeAnchor[] = [];
  const heldOut: TimeAnchor[] = [];
  anchors.forEach((anchor, index) => {
    if (index % 4 === 1) heldOut.push(anchor);
    else training.push(anchor);
  });
  return { training, heldOut };
}

function heldOutAudioWindows(anchors: readonly TimeAnchor[]): PivotHeldOutWindow[] {
  return anchors.map((anchor) => ({
    sourceSec: anchor.sourceSec,
    expectedTargetSec: anchor.targetSec,
    fromSec: Math.max(0, anchor.targetSec - 8),
    toSec: anchor.targetSec + 8,
  }));
}

function mapPivotCues(cues: readonly StructuralCue[], transform: SyncTransform): StructuralCue[] {
  return cues.map((cue) => {
    const start = applyTimeTransform(transform, cue.start);
    const end = applyTimeTransform(transform, cue.end);
    return {
      ...cue,
      start: Math.min(start, end),
      end: Math.max(start + 0.01, end),
    };
  });
}

export function evaluatePivotGate(evidence: PivotGateEvidence): PivotGateDecision {
  if (!evidence.pivotAudioValidated) {
    return {
      decision: "refuse",
      bindingRule: "pivot-audio-validation",
      reason: "The pivot subtitle was not validated against the selected audio.",
    };
  }
  if (evidence.pivotWrongCut || evidence.finalWrongCut) {
    return {
      decision: "refuse",
      bindingRule: "pivot-wrong-cut",
      reason: "The pivot or final subtitle appears to be from a different cut.",
    };
  }
  if (!evidence.pivotHealthy || !evidence.targetHealthy) {
    return {
      decision: "refuse",
      bindingRule: "pivot-subtitle-health",
      reason: "The pivot or target subtitle failed subtitle-health checks.",
    };
  }
  if (!evidence.formatSafe) {
    return {
      decision: "refuse",
      bindingRule: "pivot-format-safety",
      reason: "The transform cannot preserve this subtitle format safely.",
    };
  }
  if (evidence.pivotAudioScore < 0.5 || evidence.pivotAudioCoverage < 0.45) {
    return {
      decision: "refuse",
      bindingRule: "pivot-audio-quality",
      reason: "The pivot does not align strongly enough with the selected audio.",
    };
  }
  if (
    evidence.anchorCount < 5 ||
    evidence.targetCoverage < 0.35 ||
    Math.min(
      evidence.regionCoverage.beginning,
      evidence.regionCoverage.middle,
      evidence.regionCoverage.end,
    ) < 0.25
  ) {
    return {
      decision: "refuse",
      bindingRule: "pivot-anchor-coverage",
      reason: "Cross-language alignment did not produce enough timeline coverage.",
    };
  }
  if (evidence.heldOutMedianResidualSec !== undefined && evidence.heldOutMedianResidualSec > 1.5) {
    return {
      decision: "refuse",
      bindingRule: "pivot-held-out",
      reason: "The fitted transform failed held-out anchor validation.",
    };
  }
  if (
    evidence.qualityBefore !== undefined &&
    evidence.qualityAfter !== undefined &&
    evidence.qualityAfter < evidence.qualityBefore - 0.02
  ) {
    return {
      decision: "refuse",
      bindingRule: "pivot-never-worse",
      reason: "The pivot-derived transform makes measured alignment worse.",
    };
  }

  const fullRegionCoverage = Math.min(
    evidence.regionCoverage.beginning,
    evidence.regionCoverage.middle,
    evidence.regionCoverage.end,
  );
  const measuredImprovement =
    evidence.qualityBefore !== undefined && evidence.qualityAfter !== undefined
      ? evidence.qualityAfter - evidence.qualityBefore
      : undefined;
  const canApply =
    !evidence.bestEffort &&
    evidence.anchorCount >= 10 &&
    evidence.targetCoverage >= 0.6 &&
    fullRegionCoverage >= 0.35 &&
    evidence.heldOutCount >= 3 &&
    evidence.heldOutMedianResidualSec !== undefined &&
    evidence.heldOutMedianResidualSec <= 0.75 &&
    measuredImprovement !== undefined &&
    measuredImprovement >= 0.08 &&
    evidence.heldOutAudioMeasured &&
    (evidence.qualityAfter ?? 0) >= 0.55 &&
    (evidence.finalCoverage ?? 0) >= 0.55 &&
    evidence.releaseAgreement &&
    evidence.independentEvidenceGroups >= 2 &&
    evidence.calibrationReady;
  if (canApply) {
    return {
      decision: "apply",
      bindingRule: "pivot-all-safety-evidence",
      reason: "Validated pivot, held-out anchors, and audio measurement agree.",
    };
  }

  return {
    decision: "offer",
    bindingRule: evidence.bestEffort ? "pivot-best-effort" : "pivot-safety-ceiling",
    reason: evidence.bestEffort
      ? "Best-effort pivot results require user confirmation."
      : "The pivot estimate is plausible but lacks evidence required for automatic application.",
  };
}

function decisionRank(decision: PivotGateDecision["decision"]): number {
  return decision === "apply" ? 2 : decision === "offer" ? 1 : 0;
}

export async function runPivotWorkflow(
  input: PivotWorkflowInput,
  ports: PivotWorkflowPorts,
): Promise<PivotWorkflowResult> {
  if (
    !input.audioLanguage.trim() ||
    normalizeLanguage(input.audioLanguage) === normalizeLanguage(input.subtitleLanguage)
  ) {
    return {
      decision: {
        decision: "refuse",
        bindingRule: "pivot-not-cross-language",
        reason: "A pivot is only used when audio and subtitle languages differ.",
      },
      attempts: [],
    };
  }

  let candidates: PivotCandidate[];
  try {
    candidates = rankPivotCandidates(
      await ports.searchPivotCandidates(input.audioLanguage),
      input.audioLanguage,
    ).slice(0, Math.max(1, input.maxCandidates ?? 5));
  } catch {
    return { decision: REFUSE_NO_PIVOT, attempts: [] };
  }
  if (candidates.length === 0) return { decision: REFUSE_NO_PIVOT, attempts: [] };

  const attempts: PivotAttempt[] = [];
  for (const candidate of candidates) {
    const diagnostics: string[] = [];
    let prepared: PreparedPivotCandidate;
    try {
      prepared = await ports.preparePivotCandidate(candidate);
      diagnostics.push(...(prepared.diagnostics ?? []));
    } catch {
      attempts.push({
        candidate,
        decision: {
          decision: "refuse",
          bindingRule: "pivot-prepare-failed",
          reason: "The pivot subtitle could not be prepared safely.",
        },
        diagnostics: ["prepare-failed"],
      });
      continue;
    }

    let pivotAudio: PivotAudioValidation;
    try {
      pivotAudio = await ports.validatePivotAgainstAudio(candidate, prepared);
      diagnostics.push(...(pivotAudio.diagnostics ?? []));
    } catch {
      attempts.push({
        candidate,
        decision: {
          decision: "refuse",
          bindingRule: "pivot-audio-validation-failed",
          reason: "The pivot could not be validated against audio.",
        },
        diagnostics: [...diagnostics, "audio-validation-failed"],
      });
      continue;
    }

    const mappedPivot = mapPivotCues(prepared.cues, pivotAudio.transform);
    const alignment = alignCuesMonotonically(input.targetCues, mappedPivot);
    const { training, heldOut } = splitTrainingAndHeldOut(alignment.anchors);
    const fit = fitPreferredTimeTransform(training);
    if (!fit) {
      attempts.push({
        candidate,
        decision: {
          decision: "refuse",
          bindingRule: "pivot-fit-failed",
          reason: "Cross-language anchors could not produce a transform.",
        },
        alignment,
        diagnostics: [...diagnostics, ...alignment.diagnostics, "fit-failed"],
      });
      continue;
    }

    const heldOutMedianResidualSec = median(
      heldOut.map((anchor) =>
        Math.abs(anchor.targetSec - applyTimeTransform(fit.transform, anchor.sourceSec)),
      ),
    );
    let targetValidation: TargetAudioValidation | undefined;
    if (ports.validateTargetAgainstAudio) {
      try {
        targetValidation = await ports.validateTargetAgainstAudio(
          input.targetCues,
          fit.transform,
          heldOutAudioWindows(heldOut),
        );
      } catch {
        diagnostics.push("final-audio-validation-failed");
      }
    }

    const releaseAgreement = candidate.exactRelease || candidate.releaseScore >= 0.9;
    const evidence: PivotGateEvidence = {
      pivotAudioValidated: pivotAudio.validated,
      pivotAudioScore: pivotAudio.score,
      pivotAudioCoverage: pivotAudio.coverage,
      pivotWrongCut: pivotAudio.wrongCut,
      pivotHealthy: prepared.healthy,
      targetHealthy: input.targetHealthy,
      formatSafe: input.targetFormatSafe && prepared.formatSafe,
      anchorCount: alignment.anchors.length,
      targetCoverage: alignment.targetCoverage,
      regionCoverage: alignment.regionCoverage,
      heldOutCount: heldOut.length,
      heldOutMedianResidualSec,
      qualityBefore: targetValidation?.qualityBefore,
      qualityAfter: targetValidation?.qualityAfter,
      finalCoverage: targetValidation?.coverage,
      heldOutAudioMeasured: targetValidation?.heldOutAudioMeasured === true,
      finalWrongCut: targetValidation?.wrongCut,
      releaseAgreement,
      independentEvidenceGroups: releaseAgreement ? 3 : 2,
      calibrationReady: input.calibrationReady,
      bestEffort: input.bestEffort ?? false,
    };
    const decision = evaluatePivotGate(evidence);
    attempts.push({
      candidate,
      decision,
      evidence,
      alignment,
      fit,
      diagnostics: [...diagnostics, ...alignment.diagnostics, ...fit.diagnostics],
    });
  }

  const best = [...attempts].sort(
    (left, right) =>
      decisionRank(right.decision.decision) - decisionRank(left.decision.decision) ||
      (right.evidence?.targetCoverage ?? 0) - (left.evidence?.targetCoverage ?? 0) ||
      right.candidate.releaseScore - left.candidate.releaseScore ||
      stableTextCompare(left.candidate.id, right.candidate.id),
  )[0];
  if (!best || !best.fit) return { decision: REFUSE_NO_PIVOT, attempts };
  return {
    decision: best.decision,
    candidate: best.candidate,
    transform: best.fit.transform,
    alignment: best.alignment,
    fit: best.fit,
    evidence: best.evidence,
    attempts,
  };
}
