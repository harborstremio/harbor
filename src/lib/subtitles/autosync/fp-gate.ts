import type { FusedConfidence } from "./confidence";

export type AffineTransform = { kind: "affine"; offsetSec: number; ratio: number };
export type PiecewiseSegment = {
  fromSec: number;
  toSec: number;
  offsetSec: number;
  ratio: number;
};
export type PiecewiseTransform = { kind: "piecewise"; segments: PiecewiseSegment[] };
export type SyncTransform = AffineTransform | PiecewiseTransform;

export type AlignmentQuality = { ncc: number; coverage: number; z: number };

export type QualityUnknownReason =
  | "timeout"
  | "ffmpeg-unavailable"
  | "audio-unavailable"
  | "not-supported"
  | "insufficient-data"
  | "provider-error";

export type HeldOutValidation = {
  kind: "held-out";
  windowIds: string[];
  windows?: QualityValidationWindow[];
  provenance?: string;
  requestProvenance?: string;
};

export type QualityValidationWindow = {
  id: string;
  fromSec: number;
  toSec: number;
};

export type QualityMeasurement =
  | {
      status: "measured";
      value: AlignmentQuality;
      method: string;
      validation?: HeldOutValidation;
    }
  | {
      status: "unknown";
      reason: QualityUnknownReason;
      method?: string;
    };

export type QualityMeasurementRequest = {
  purpose: "validation";
  excludeWindowIds?: string[];
  validationWindows?: QualityValidationWindow[];
  validationProvenance?: string;
};

export type CandidateKind = "exact-file-hash" | "structural";
export type SubtitleFormat = "srt" | "vtt" | "ass" | "ssa" | "unknown";

export type Bounds = {
  maxOffsetSec: number;
  hardOffsetCapSec: number;
  maxFramerateDev: number;
  knownRatios: number[];
  ratioSnapTol: number;
};

export type GateInputs = {
  transform: SyncTransform;
  confidence: FusedConfidence;
  qualityBefore: QualityMeasurement;
  qualityAfter: QualityMeasurement;
  bounds: Bounds;
  exactIdentity: boolean;
  candidateKind: CandidateKind;
  calibrationReady: boolean;
  structuralAutoApplyEnabled: boolean;
  subtitleFormat: SubtitleFormat;
  fitWindowIds?: string[];
  asrWordMatch?: number;
  priorRuntimeOk?: boolean;
  inputAlreadyGood: boolean;
  requireImprovement?: boolean;
};

export type Outcome = "refuse" | "offer" | "apply";

export type GateDecision = {
  decision: Outcome;
  reason: string;
  pCorrect: number;
  transform: SyncTransform;
  bindingRule: string;
};

export const DEFAULT_BOUNDS: Bounds = {
  maxOffsetSec: 30,
  hardOffsetCapSec: 60,
  maxFramerateDev: 0.1,
  knownRatios: [
    1,
    25 / 24,
    24 / 25,
    25 / 23.976,
    23.976 / 25,
    24 / 23.976,
    23.976 / 24,
    30 / 29.97,
    29.97 / 30,
  ],
  ratioSnapTol: 0.0015,
};

export const THRESHOLDS = {
  applyExact: 0.97,
  applyMulti: 0.9,
  offerFloor: 0.65,
  minImprovement: 0.08,
  exactSlack: 0.05,
  minAbsoluteNcc: 0.55,
  minCoverage: 0.6,
  exactMinCoverage: 0.4,
  wrongContentFloor: 0.2,
  maxConflict: 0.35,
  hardConflict: 0.6,
  alreadyGoodNcc: 0.85,
};

const RANK: Record<Outcome, number> = { refuse: 0, offer: 1, apply: 2 };

type Rule = { name: string; ceiling: Outcome; reason: string };

export function measuredQuality(
  value: AlignmentQuality,
  method: string,
  validation?: HeldOutValidation,
): QualityMeasurement {
  if (
    ![value.ncc, value.coverage, value.z].every(Number.isFinite) ||
    value.ncc < -1 ||
    value.ncc > 1 ||
    value.coverage < 0 ||
    value.coverage > 1
  ) {
    return unknownQuality("insufficient-data", method);
  }
  return validation
    ? { status: "measured", value, method, validation }
    : { status: "measured", value, method };
}

export function unknownQuality(reason: QualityUnknownReason, method?: string): QualityMeasurement {
  return method ? { status: "unknown", reason, method } : { status: "unknown", reason };
}

export function isDelayOnlyTransform(t: SyncTransform): t is AffineTransform {
  return t.kind === "affine" && Math.abs(t.ratio - 1) < 0.000001;
}

function segmentsOf(t: SyncTransform): PiecewiseSegment[] {
  if (t.kind === "affine") {
    return [{ fromSec: 0, toSec: Infinity, offsetSec: t.offsetSec, ratio: t.ratio }];
  }
  return t.segments;
}

function snapsToKnownRatio(ratio: number, b: Bounds): boolean {
  return b.knownRatios.some((r) => Math.abs(ratio - r) <= b.ratioSnapTol);
}

function promotionCeiling(inp: GateInputs): Rule {
  const p = inp.confidence.pCorrect;
  if (inp.exactIdentity && p >= THRESHOLDS.applyExact) {
    return {
      name: "promotion",
      ceiling: "apply",
      reason: "exact-identity, high calibrated confidence",
    };
  }
  if (inp.confidence.agreeingSignals >= 2 && p >= THRESHOLDS.applyMulti) {
    return { name: "promotion", ceiling: "apply", reason: "two independent signals agree" };
  }
  if (p >= THRESHOLDS.offerFloor) {
    return { name: "promotion", ceiling: "offer", reason: "single-signal moderate confidence" };
  }
  return { name: "promotion", ceiling: "refuse", reason: "confidence below offer floor" };
}

function measurementVeto(inp: GateInputs): Rule {
  if (inp.qualityAfter.status === "unknown") {
    const detail = inp.qualityAfter.reason.replaceAll("-", " ");
    if (inp.candidateKind === "exact-file-hash") {
      return {
        name: "quality-measurement",
        ceiling: "offer",
        reason: `exact file/hash match available, but post-sync quality is unknown (${detail})`,
      };
    }
    return {
      name: "quality-measurement",
      ceiling: "refuse",
      reason: `post-sync quality is unknown (${detail})`,
    };
  }
  if (inp.qualityBefore.status === "unknown") {
    const detail = inp.qualityBefore.reason.replaceAll("-", " ");
    return {
      name: "quality-measurement",
      ceiling: inp.candidateKind === "exact-file-hash" ? "offer" : "refuse",
      reason: `pre-sync quality is unknown (${detail}), so improvement cannot be verified`,
    };
  }
  return { name: "quality-measurement", ceiling: "apply", reason: "quality measured" };
}

function heldOutValidationVeto(inp: GateInputs): Rule {
  if (inp.qualityBefore.status !== "measured" || inp.qualityAfter.status !== "measured") {
    return {
      name: "held-out-validation",
      ceiling: "apply",
      reason: "quality failure handled separately",
    };
  }
  const beforeIds = inp.qualityBefore.validation?.windowIds ?? [];
  const afterIds = inp.qualityAfter.validation?.windowIds ?? [];
  if (beforeIds.length === 0 || afterIds.length === 0) {
    return {
      name: "held-out-validation",
      ceiling: "offer",
      reason: "held-out validation has not been measured",
    };
  }
  const before = new Set(beforeIds);
  const after = new Set(afterIds);
  if (
    before.size !== beforeIds.length ||
    after.size !== afterIds.length ||
    before.size !== after.size ||
    [...after].some((id) => !before.has(id))
  ) {
    return {
      name: "held-out-validation",
      ceiling: "refuse",
      reason: "pre-sync and post-sync quality used different validation windows",
    };
  }
  const fit = new Set(inp.fitWindowIds ?? []);
  if (inp.candidateKind === "structural" && fit.size === 0) {
    return {
      name: "held-out-validation",
      ceiling: "offer",
      reason: "transform fit windows are unknown, so held-out independence cannot be verified",
    };
  }
  if (afterIds.some((id) => fit.has(id))) {
    return {
      name: "held-out-validation",
      ceiling: "refuse",
      reason: "validation overlaps windows used to fit the transform",
    };
  }
  return { name: "held-out-validation", ceiling: "apply", reason: "held-out quality improves" };
}

function formatSafetyVeto(inp: GateInputs): Rule {
  if (isDelayOnlyTransform(inp.transform)) {
    return {
      name: "format-safety",
      ceiling: "apply",
      reason: "delay-only correction preserves subtitle formatting",
    };
  }
  if (inp.subtitleFormat === "ass" || inp.subtitleFormat === "ssa") {
    return {
      name: "format-safety",
      ceiling: "refuse",
      reason: `${inp.subtitleFormat.toUpperCase()} structural rewriting is disabled to preserve formatting`,
    };
  }
  if (inp.subtitleFormat === "unknown") {
    return {
      name: "format-safety",
      ceiling: "refuse",
      reason: "subtitle format is unknown, so structural rewriting is disabled",
    };
  }
  return { name: "format-safety", ceiling: "apply", reason: "subtitle format can be preserved" };
}

function calibrationVeto(inp: GateInputs): Rule {
  if (!inp.calibrationReady) {
    return {
      name: "calibration-release",
      ceiling: "offer",
      reason:
        inp.candidateKind === "structural"
          ? "structural calibration is provisional"
          : "auto-apply calibration is provisional",
    };
  }
  return { name: "calibration-release", ceiling: "apply", reason: "calibration is release-ready" };
}

function structuralOptInVeto(inp: GateInputs): Rule {
  if (inp.candidateKind === "structural" && !inp.structuralAutoApplyEnabled) {
    return {
      name: "structural-opt-in",
      ceiling: "offer",
      reason: "structural auto-apply is disabled",
    };
  }
  return {
    name: "structural-opt-in",
    ceiling: "apply",
    reason: "structural auto-apply is enabled",
  };
}

function boundedSearchVeto(inp: GateInputs): Rule {
  const b = inp.bounds;
  let ceiling: Outcome = "apply";
  let reason = "within physical bounds";
  for (const seg of segmentsOf(inp.transform)) {
    const off = Math.abs(seg.offsetSec);
    if (off > b.hardOffsetCapSec) {
      return {
        name: "bounded-search",
        ceiling: "refuse",
        reason: `offset ${seg.offsetSec.toFixed(1)}s exceeds hard cap`,
      };
    }
    const dev = Math.abs(seg.ratio - 1);
    if (dev > b.maxFramerateDev && !snapsToKnownRatio(seg.ratio, b)) {
      return {
        name: "bounded-search",
        ceiling: "refuse",
        reason: `ratio ${seg.ratio.toFixed(4)} off physical fps grid`,
      };
    }
    if (off > b.maxOffsetSec) {
      if (!inp.exactIdentity) {
        return {
          name: "bounded-search",
          ceiling: "refuse",
          reason: `offset ${seg.offsetSec.toFixed(1)}s beyond plausible range`,
        };
      }
      ceiling = "offer";
      reason = "large offset on exact match, confirm before applying";
    }
  }
  return { name: "bounded-search", ceiling, reason };
}

function neverWorseVeto(inp: GateInputs): Rule {
  if (inp.qualityBefore.status !== "measured" || inp.qualityAfter.status !== "measured") {
    return { name: "never-worse", ceiling: "apply", reason: "quality failure handled separately" };
  }
  const before = inp.qualityBefore.value.ncc;
  const after = inp.qualityAfter.value.ncc;
  if (after < THRESHOLDS.minAbsoluteNcc) {
    return {
      name: "never-worse",
      ceiling: "refuse",
      reason: `post-sync ncc ${after.toFixed(2)} below absolute floor`,
    };
  }
  const lenient = inp.exactIdentity && !inp.requireImprovement;
  const need = lenient ? -THRESHOLDS.exactSlack : THRESHOLDS.minImprovement;
  const delta = after - before;
  if (delta < need) {
    if (lenient && delta >= -THRESHOLDS.exactSlack * 2) {
      return {
        name: "never-worse",
        ceiling: "offer",
        reason: "exact match shows no clear improvement",
      };
    }
    if (inp.requireImprovement && delta >= -THRESHOLDS.exactSlack) {
      return {
        name: "never-worse",
        ceiling: "offer",
        reason: "swapped subtitle not clearly better than input",
      };
    }
    return {
      name: "never-worse",
      ceiling: "refuse",
      reason: `not better than input (delta ncc ${delta.toFixed(2)})`,
    };
  }
  return { name: "never-worse", ceiling: "apply", reason: "clearly better than input" };
}

function classCVeto(inp: GateInputs): Rule {
  if (inp.asrWordMatch === undefined) {
    return { name: "class-c", ceiling: "apply", reason: "asr verification not run" };
  }
  if (inp.asrWordMatch < THRESHOLDS.wrongContentFloor) {
    return {
      name: "class-c",
      ceiling: "refuse",
      reason: `wrong content: asr word-match ${(inp.asrWordMatch * 100).toFixed(0)}%`,
    };
  }
  return { name: "class-c", ceiling: "apply", reason: "spoken words match subtitle text" };
}

function coverageVeto(inp: GateInputs): Rule {
  if (inp.qualityAfter.status !== "measured") {
    return { name: "coverage", ceiling: "apply", reason: "quality failure handled separately" };
  }
  const floor =
    inp.exactIdentity && !inp.requireImprovement
      ? THRESHOLDS.exactMinCoverage
      : THRESHOLDS.minCoverage;
  if (inp.qualityAfter.value.coverage < floor) {
    return {
      name: "coverage",
      ceiling: "refuse",
      reason: `cue-on-speech coverage ${(inp.qualityAfter.value.coverage * 100).toFixed(0)}% too low`,
    };
  }
  return { name: "coverage", ceiling: "apply", reason: "cues land on speech" };
}

function conflictVeto(inp: GateInputs): Rule {
  const k = inp.confidence.conflictK;
  if (k > THRESHOLDS.hardConflict) {
    return {
      name: "conflict",
      ceiling: "refuse",
      reason: `signals in hard conflict (K=${k.toFixed(2)})`,
    };
  }
  if (k > THRESHOLDS.maxConflict) {
    return {
      name: "conflict",
      ceiling: "offer",
      reason: `independent signals disagree (K=${k.toFixed(2)})`,
    };
  }
  return { name: "conflict", ceiling: "apply", reason: "signals coherent" };
}

function alreadyGoodVeto(inp: GateInputs): Rule {
  if (!inp.inputAlreadyGood) {
    return { name: "already-good", ceiling: "apply", reason: "input needs correction" };
  }
  if (inp.exactIdentity) {
    return {
      name: "already-good",
      ceiling: "offer",
      reason: "input already good, exact swap optional",
    };
  }
  return {
    name: "already-good",
    ceiling: "refuse",
    reason: "input already well aligned, leaving untouched",
  };
}

function runtimeVeto(inp: GateInputs): Rule {
  if (inp.priorRuntimeOk === false) {
    return {
      name: "runtime-prior",
      ceiling: "offer",
      reason: "duration disagrees with expected runtime, confirm",
    };
  }
  return { name: "runtime-prior", ceiling: "apply", reason: "runtime prior consistent" };
}

export function evaluateGate(inp: GateInputs): GateDecision {
  const rules: Rule[] = [
    measurementVeto(inp),
    formatSafetyVeto(inp),
    heldOutValidationVeto(inp),
    calibrationVeto(inp),
    structuralOptInVeto(inp),
    promotionCeiling(inp),
    boundedSearchVeto(inp),
    neverWorseVeto(inp),
    classCVeto(inp),
    coverageVeto(inp),
    conflictVeto(inp),
    alreadyGoodVeto(inp),
    runtimeVeto(inp),
  ];

  let decision: Outcome = "apply";
  let reason = "clear to apply";
  let bindingRule = "default";
  for (const r of rules) {
    if (RANK[r.ceiling] < RANK[decision]) {
      decision = r.ceiling;
      reason = r.reason;
      bindingRule = r.name;
    }
  }

  return {
    decision,
    reason,
    bindingRule,
    pCorrect: inp.confidence.pCorrect,
    transform: inp.transform,
  };
}

export function outcomeRank(o: Outcome): number {
  return RANK[o];
}

export function evaluateBestEffort(inp: GateInputs): GateDecision {
  const gated = evaluateGate(inp);
  if (gated.decision !== "apply") return gated;
  return {
    ...gated,
    decision: "offer",
    reason: "best-effort estimate requires confirmation",
    bindingRule: "best-effort-max-offer",
  };
}
