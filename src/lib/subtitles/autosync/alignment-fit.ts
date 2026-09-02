import type { PiecewiseSegment, SyncTransform } from "./fp-gate";

export type TimeAnchor = {
  sourceSec: number;
  targetSec: number;
  weight?: number;
};

export type AlignmentModel = "identity" | "offset" | "affine" | "piecewise";

export type PreferredFitOptions = {
  identityToleranceSec?: number;
  offsetToleranceSec?: number;
  minAffineImprovementSec?: number;
  minAffineSpanSec?: number;
  ratioBounds?: [number, number];
  ratioSnapTolerance?: number;
  inlierFloorSec?: number;
  maxSegments?: number;
  minSegmentAnchors?: number;
  piecewisePenaltySec?: number;
  minPiecewiseImprovementSec?: number;
};

export type PreferredFitResult = {
  model: AlignmentModel;
  transform: SyncTransform;
  anchorCount: number;
  inlierCount: number;
  residualMedianSec: number;
  residualMadSec: number;
  maxResidualSec: number;
  diagnostics: string[];
};

type LineFit = {
  offsetSec: number;
  ratio: number;
};

type SegmentRange = {
  from: number;
  to: number;
  fit: LineFit;
};

const KNOWN_RATIOS = [
  1,
  25 / 24,
  24 / 25,
  25 / 23.976,
  23.976 / 25,
  24 / 23.976,
  23.976 / 24,
  30 / 29.97,
  29.97 / 30,
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianAbsoluteDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function sanitizeAnchors(anchors: readonly TimeAnchor[]): TimeAnchor[] {
  return anchors
    .filter(
      (anchor) =>
        Number.isFinite(anchor.sourceSec) &&
        Number.isFinite(anchor.targetSec) &&
        (anchor.weight === undefined || (Number.isFinite(anchor.weight) && anchor.weight > 0)),
    )
    .map((anchor) => ({ ...anchor, weight: anchor.weight ?? 1 }))
    .sort(
      (a, b) =>
        a.sourceSec - b.sourceSec || a.targetSec - b.targetSec || (b.weight ?? 1) - (a.weight ?? 1),
    );
}

function snapRatio(ratio: number, tolerance: number, bounds: [number, number]): number {
  const bounded = clamp(ratio, bounds[0], bounds[1]);
  let best = bounded;
  let distance = tolerance;
  for (const known of KNOWN_RATIOS) {
    const nextDistance = Math.abs(bounded - known);
    if (nextDistance <= distance) {
      best = known;
      distance = nextDistance;
    }
  }
  return best;
}

function fitIdentity(): LineFit {
  return { offsetSec: 0, ratio: 1 };
}

function fitOffset(anchors: readonly TimeAnchor[]): LineFit {
  return {
    offsetSec: median(anchors.map((anchor) => anchor.targetSec - anchor.sourceSec)),
    ratio: 1,
  };
}

function fitAffine(
  anchors: readonly TimeAnchor[],
  ratioTolerance: number,
  ratioBounds: [number, number],
): LineFit {
  if (anchors.length < 3) return fitOffset(anchors);
  const slopes: number[] = [];
  for (let left = 0; left < anchors.length; left += 1) {
    for (let right = left + 1; right < anchors.length; right += 1) {
      const span = anchors[right].sourceSec - anchors[left].sourceSec;
      if (Math.abs(span) < 0.25) continue;
      slopes.push((anchors[right].targetSec - anchors[left].targetSec) / span);
    }
  }
  const ratio = snapRatio(slopes.length > 0 ? median(slopes) : 1, ratioTolerance, ratioBounds);
  const offsetSec = median(anchors.map((anchor) => anchor.targetSec - ratio * anchor.sourceSec));
  return { offsetSec, ratio };
}

function fitLeastSquares(
  anchors: readonly TimeAnchor[],
  ratioTolerance: number,
  ratioBounds: [number, number],
): LineFit {
  if (anchors.length < 3) return fitOffset(anchors);
  let weightSum = 0;
  let sourceMean = 0;
  let targetMean = 0;
  for (const anchor of anchors) {
    const weight = anchor.weight ?? 1;
    weightSum += weight;
    sourceMean += anchor.sourceSec * weight;
    targetMean += anchor.targetSec * weight;
  }
  sourceMean /= weightSum;
  targetMean /= weightSum;
  let sourceVariance = 0;
  let covariance = 0;
  for (const anchor of anchors) {
    const weight = anchor.weight ?? 1;
    sourceVariance += weight * (anchor.sourceSec - sourceMean) ** 2;
    covariance += weight * (anchor.sourceSec - sourceMean) * (anchor.targetSec - targetMean);
  }
  const rawRatio = sourceVariance > 1 ? covariance / sourceVariance : 1;
  const ratio = snapRatio(rawRatio, ratioTolerance, ratioBounds);
  return { offsetSec: targetMean - ratio * sourceMean, ratio };
}

function signedResiduals(anchors: readonly TimeAnchor[], fit: LineFit): number[] {
  return anchors.map((anchor) => anchor.targetSec - (fit.offsetSec + fit.ratio * anchor.sourceSec));
}

function absoluteError(anchors: readonly TimeAnchor[], fit: LineFit): number {
  return signedResiduals(anchors, fit).reduce(
    (sum, residual, index) => sum + Math.abs(residual) * (anchors[index].weight ?? 1),
    0,
  );
}

function robustLineFit(
  anchors: readonly TimeAnchor[],
  model: "offset" | "affine",
  options: Required<PreferredFitOptions>,
): { fit: LineFit; inliers: TimeAnchor[] } {
  const initial =
    model === "offset"
      ? fitOffset(anchors)
      : fitAffine(anchors, options.ratioSnapTolerance, options.ratioBounds);
  const residuals = signedResiduals(anchors, initial);
  const center = median(residuals);
  const band = Math.max(options.inlierFloorSec, medianAbsoluteDeviation(residuals) * 3.5);
  const inliers = anchors.filter((_anchor, index) => Math.abs(residuals[index] - center) <= band);
  const usable = inliers.length >= Math.min(3, anchors.length) ? inliers : [...anchors];
  const fit =
    model === "offset"
      ? fitOffset(usable)
      : fitAffine(usable, options.ratioSnapTolerance, options.ratioBounds);
  return { fit, inliers: usable };
}

function findPiecewiseSegments(
  anchors: readonly TimeAnchor[],
  base: LineFit,
  options: Required<PreferredFitOptions>,
): SegmentRange[] {
  let ranges: SegmentRange[] = [{ from: 0, to: anchors.length, fit: base }];
  const complexityPenalty = options.piecewisePenaltySec * anchors.length;

  while (ranges.length < options.maxSegments) {
    let best:
      | {
          rangeIndex: number;
          split: number;
          leftFit: LineFit;
          rightFit: LineFit;
          gain: number;
        }
      | undefined;

    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      const range = ranges[rangeIndex];
      const count = range.to - range.from;
      if (count < options.minSegmentAnchors * 2) continue;
      const rangeAnchors = anchors.slice(range.from, range.to);
      const baseError = absoluteError(rangeAnchors, range.fit);
      const stride = Math.max(1, Math.floor(count / 80));
      for (
        let split = range.from + options.minSegmentAnchors;
        split <= range.to - options.minSegmentAnchors;
        split += stride
      ) {
        const left = anchors.slice(range.from, split);
        const right = anchors.slice(split, range.to);
        const leftFit = fitLeastSquares(left, options.ratioSnapTolerance, options.ratioBounds);
        const rightFit = fitLeastSquares(right, options.ratioSnapTolerance, options.ratioBounds);
        const gain =
          baseError -
          absoluteError(left, leftFit) -
          absoluteError(right, rightFit) -
          complexityPenalty;
        if (!best || gain > best.gain) {
          best = { rangeIndex, split, leftFit, rightFit, gain };
        }
      }
    }

    if (!best || best.gain <= 0) break;
    const previous = ranges[best.rangeIndex];
    ranges.splice(
      best.rangeIndex,
      1,
      { from: previous.from, to: best.split, fit: best.leftFit },
      { from: best.split, to: previous.to, fit: best.rightFit },
    );
  }

  return ranges.map((range) => ({
    ...range,
    fit: robustLineFit(anchors.slice(range.from, range.to), "affine", options).fit,
  }));
}

function piecewiseTransform(
  anchors: readonly TimeAnchor[],
  ranges: readonly SegmentRange[],
): SyncTransform {
  const segments: PiecewiseSegment[] = ranges.map((range, index) => {
    const previous = index > 0 ? anchors[range.from - 1].sourceSec : 0;
    const first = anchors[range.from].sourceSec;
    const last = anchors[range.to - 1].sourceSec;
    const next = range.to < anchors.length ? anchors[range.to].sourceSec : last;
    return {
      fromSec: index === 0 ? 0 : (previous + first) / 2,
      toSec: index === ranges.length - 1 ? Math.max(last, next) : (last + next) / 2,
      offsetSec: range.fit.offsetSec,
      ratio: range.fit.ratio,
    };
  });
  return { kind: "piecewise", segments };
}

function isNondecreasingPiecewiseTransform(transform: SyncTransform): boolean {
  if (transform.kind !== "piecewise" || transform.segments.length === 0) return false;
  for (let index = 0; index < transform.segments.length; index += 1) {
    const segment = transform.segments[index];
    if (
      ![segment.fromSec, segment.toSec, segment.offsetSec, segment.ratio].every(Number.isFinite) ||
      segment.fromSec >= segment.toSec ||
      segment.ratio <= 0
    ) {
      return false;
    }
    const previous = transform.segments[index - 1];
    if (!previous) continue;
    if (previous.toSec !== segment.fromSec) return false;
    const boundarySec = segment.fromSec;
    const previousTarget = previous.offsetSec + previous.ratio * boundarySec;
    const nextTarget = segment.offsetSec + segment.ratio * boundarySec;
    if (nextTarget < previousTarget) return false;
  }
  return true;
}

export function applyTimeTransform(transform: SyncTransform, sourceSec: number): number {
  if (transform.kind === "affine") {
    return transform.offsetSec + transform.ratio * sourceSec;
  }
  if (transform.segments.length === 0) return sourceSec;
  const segment =
    transform.segments.find(
      (candidate) => sourceSec >= candidate.fromSec && sourceSec < candidate.toSec,
    ) ??
    (sourceSec < transform.segments[0].fromSec
      ? transform.segments[0]
      : transform.segments[transform.segments.length - 1]);
  return segment.offsetSec + segment.ratio * sourceSec;
}

function residualSummary(
  anchors: readonly TimeAnchor[],
  transform: SyncTransform,
): Pick<PreferredFitResult, "residualMedianSec" | "residualMadSec" | "maxResidualSec"> {
  const residuals = anchors.map((anchor) =>
    Math.abs(anchor.targetSec - applyTimeTransform(transform, anchor.sourceSec)),
  );
  return {
    residualMedianSec: median(residuals),
    residualMadSec: medianAbsoluteDeviation(residuals),
    maxResidualSec: residuals.length > 0 ? Math.max(...residuals) : 0,
  };
}

const DEFAULT_OPTIONS: Required<PreferredFitOptions> = {
  identityToleranceSec: 0.12,
  offsetToleranceSec: 0.35,
  minAffineImprovementSec: 0.12,
  minAffineSpanSec: 60,
  ratioBounds: [0.8, 1.25],
  ratioSnapTolerance: 0.0015,
  inlierFloorSec: 0.35,
  maxSegments: 3,
  minSegmentAnchors: 4,
  piecewisePenaltySec: 0.12,
  minPiecewiseImprovementSec: 0.18,
};

export function fitPreferredTimeTransform(
  rawAnchors: readonly TimeAnchor[],
  suppliedOptions: PreferredFitOptions = {},
): PreferredFitResult | null {
  const options: Required<PreferredFitOptions> = {
    ...DEFAULT_OPTIONS,
    ...suppliedOptions,
    ratioBounds: suppliedOptions.ratioBounds ?? DEFAULT_OPTIONS.ratioBounds,
  };
  const anchors = sanitizeAnchors(rawAnchors);
  if (anchors.length === 0) return null;
  const diagnostics: string[] = [];

  const identity: SyncTransform = { kind: "affine", offsetSec: 0, ratio: 1 };
  const identitySummary = residualSummary(anchors, identity);
  if (identitySummary.residualMedianSec <= options.identityToleranceSec) {
    return {
      model: "identity",
      transform: identity,
      anchorCount: anchors.length,
      inlierCount: anchors.length,
      ...identitySummary,
      diagnostics: ["identity-within-tolerance"],
    };
  }

  const offsetFit = robustLineFit(anchors, "offset", options);
  const offsetTransform: SyncTransform = { kind: "affine", ...offsetFit.fit };
  const offsetSummary = residualSummary(anchors, offsetTransform);
  let model: AlignmentModel = "offset";
  let transform: SyncTransform = offsetTransform;
  let inlierCount = offsetFit.inliers.length;
  let summary = offsetSummary;

  const spanSec = anchors[anchors.length - 1].sourceSec - anchors[0].sourceSec;
  if (anchors.length >= 3 && spanSec >= options.minAffineSpanSec) {
    const affineFit = robustLineFit(anchors, "affine", options);
    const affineTransform: SyncTransform = { kind: "affine", ...affineFit.fit };
    const affineSummary = residualSummary(anchors, affineTransform);
    const affineImprovement = offsetSummary.residualMedianSec - affineSummary.residualMedianSec;
    if (
      offsetSummary.residualMedianSec > options.offsetToleranceSec &&
      affineImprovement >= options.minAffineImprovementSec
    ) {
      model = "affine";
      transform = affineTransform;
      inlierCount = affineFit.inliers.length;
      summary = affineSummary;
      diagnostics.push("affine-materially-improves-offset");
    } else {
      diagnostics.push("simpler-offset-preferred");
    }
  } else {
    diagnostics.push("insufficient-span-for-affine");
  }

  if (anchors.length >= options.minSegmentAnchors * 2 && options.maxSegments > 1) {
    const baseFit: LineFit =
      transform.kind === "affine"
        ? { offsetSec: transform.offsetSec, ratio: transform.ratio }
        : fitIdentity();
    const ranges = findPiecewiseSegments(anchors, baseFit, options);
    if (ranges.length > 1) {
      const candidate = piecewiseTransform(anchors, ranges);
      if (!isNondecreasingPiecewiseTransform(candidate)) {
        diagnostics.push("non-monotonic-piecewise-rejected");
      } else {
        const candidateSummary = residualSummary(anchors, candidate);
        const improvement = summary.residualMedianSec - candidateSummary.residualMedianSec;
        const relativeImprovement = improvement / Math.max(0.01, summary.residualMedianSec);
        if (improvement >= options.minPiecewiseImprovementSec && relativeImprovement >= 0.25) {
          model = "piecewise";
          transform = candidate;
          summary = candidateSummary;
          inlierCount = anchors.length;
          diagnostics.push("regularized-piecewise-materially-improves-affine");
        } else {
          diagnostics.push("simpler-global-model-preferred");
        }
      }
    }
  }

  return {
    model,
    transform,
    anchorCount: anchors.length,
    inlierCount,
    ...summary,
    diagnostics,
  };
}
