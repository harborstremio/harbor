import type { TimeAnchor } from "./alignment-fit";

export type StructuralCue = {
  start: number;
  end: number;
  text: string;
};

export type MonotonicAlignmentOptions = {
  bandFraction?: number;
  skipPenalty?: number;
  mergePenalty?: number;
  minAnchorConfidence?: number;
};

export type MonotonicMatch = {
  targetFrom: number;
  targetTo: number;
  pivotFrom: number;
  pivotTo: number;
  transition: "1:1" | "1:2" | "2:1";
  cost: number;
  confidence: number;
};

export type AlignmentRegionCoverage = {
  beginning: number;
  middle: number;
  end: number;
};

export type MonotonicAlignmentResult = {
  matches: MonotonicMatch[];
  anchors: TimeAnchor[];
  targetCoverage: number;
  pivotCoverage: number;
  regionCoverage: AlignmentRegionCoverage;
  averageMatchCost: number;
  confidence: number;
  diagnostics: string[];
};

type CueGroup = {
  from: number;
  to: number;
  start: number;
  end: number;
  center: number;
  duration: number;
  text: string;
  lineCount: number;
  gapBefore: number;
  gapAfter: number;
  progress: number;
  characterLength: number;
  numberTokens: Set<string>;
  latinTokens: Set<string>;
  punctuation: number;
};

type CueGroupIndex = {
  single: CueGroup[];
  double: CueGroup[];
};

const DEFAULT_OPTIONS: Required<MonotonicAlignmentOptions> = {
  bandFraction: 0.24,
  skipPenalty: 0.92,
  mergePenalty: 0.14,
  minAnchorConfidence: 0.24,
};
const EPSILON = 1e-9;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function validCues(cues: readonly StructuralCue[]): StructuralCue[] {
  return cues
    .filter(
      (cue) =>
        Number.isFinite(cue.start) &&
        Number.isFinite(cue.end) &&
        cue.end > cue.start &&
        cue.text.trim().length > 0,
    )
    .map((cue) => ({ ...cue }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.text.localeCompare(b.text));
}

function cueGroup(cues: readonly StructuralCue[], from: number, to: number): CueGroup {
  const first = cues[from];
  const last = cues[to - 1];
  const start = first.start;
  const end = last.end;
  const text = cues
    .slice(from, to)
    .map((cue) => cue.text)
    .join(" ");
  const timelineStart = cues[0].start;
  const timelineSpan = Math.max(1, cues[cues.length - 1].end - timelineStart);
  return {
    from,
    to,
    start,
    end,
    center: (start + end) / 2,
    duration: Math.max(0.05, end - start),
    text,
    lineCount: cues
      .slice(from, to)
      .reduce((count, cue) => count + cue.text.split(/\r?\n/gu).length, 0),
    gapBefore: from > 0 ? Math.max(0, start - cues[from - 1].end) : 0,
    gapAfter: to < cues.length ? Math.max(0, cues[to].start - end) : 0,
    progress: clamp01(((start + end) / 2 - timelineStart) / timelineSpan),
    characterLength: [...text.replace(/\s/gu, "")].length,
    numberTokens: tokens(text, /\p{N}+(?:[.:/]\p{N}+)*/gu),
    latinTokens: tokens(text, /[a-z][a-z0-9'-]{2,}/giu),
    punctuation: punctuationSignature(text),
  };
}

function indexCueGroups(cues: readonly StructuralCue[]): CueGroupIndex {
  return {
    single: cues.map((_cue, index) => cueGroup(cues, index, index + 1)),
    double: cues.slice(0, -1).map((_cue, index) => cueGroup(cues, index, index + 2)),
  };
}

function tokens(text: string, pattern: RegExp): Set<string> {
  return new Set(
    [...text.toLocaleLowerCase().matchAll(pattern)].map((match) => match[0]).filter(Boolean),
  );
}

function setDistance(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return 1 - intersection / Math.max(1, left.size + right.size - intersection);
}

function punctuationSignature(text: string): number {
  let signature = 0;
  if (/[?؟]/u.test(text)) signature |= 1;
  if (/!/u.test(text)) signature |= 2;
  if (/(?:\.{3}|…)/u.test(text)) signature |= 4;
  if (/[()[\]{}]/u.test(text)) signature |= 8;
  return signature;
}

function ratioDistance(left: number, right: number): number {
  return Math.min(1.5, Math.abs(Math.log((left + 0.1) / (right + 0.1))));
}

function matchCost(targetGroup: CueGroup, pivotGroup: CueGroup): number {
  const positionDifference = Math.abs(targetGroup.progress - pivotGroup.progress);
  const durationDifference = ratioDistance(targetGroup.duration, pivotGroup.duration);
  const lengthDifference = ratioDistance(targetGroup.characterLength, pivotGroup.characterLength);
  const lineDifference = Math.min(2, Math.abs(targetGroup.lineCount - pivotGroup.lineCount));
  const gapDifference =
    ratioDistance(targetGroup.gapBefore, pivotGroup.gapBefore) +
    ratioDistance(targetGroup.gapAfter, pivotGroup.gapAfter);
  const numberDistance = setDistance(targetGroup.numberTokens, pivotGroup.numberTokens);
  const latinDistance = setDistance(targetGroup.latinTokens, pivotGroup.latinTokens);
  const punctuationDifference = targetGroup.punctuation === pivotGroup.punctuation ? 0 : 1;
  const sharedSignalWeight =
    (numberDistance > 0 || /\p{N}/u.test(targetGroup.text + pivotGroup.text) ? 0.32 : 0) +
    (latinDistance > 0 || /[a-z]{3}/iu.test(targetGroup.text + pivotGroup.text) ? 0.24 : 0);

  return (
    Math.min(1.2, positionDifference * 3.2) +
    durationDifference * 0.34 +
    lengthDifference * 0.12 +
    lineDifference * 0.07 +
    gapDifference * 0.08 +
    punctuationDifference * 0.08 +
    numberDistance * (sharedSignalWeight > 0 ? 0.32 : 0) +
    latinDistance * (sharedSignalWeight > 0 ? 0.24 : 0)
  );
}

function cellIndex(i: number, j: number, width: number): number {
  return i * width + j;
}

function emptyResult(diagnostic: string): MonotonicAlignmentResult {
  return {
    matches: [],
    anchors: [],
    targetCoverage: 0,
    pivotCoverage: 0,
    regionCoverage: { beginning: 0, middle: 0, end: 0 },
    averageMatchCost: Infinity,
    confidence: 0,
    diagnostics: [diagnostic],
  };
}

function coverageByRegion(matched: Set<number>, count: number): AlignmentRegionCoverage {
  const ratios: number[] = [];
  for (let region = 0; region < 3; region += 1) {
    const from = Math.floor((region * count) / 3);
    const to = Math.floor(((region + 1) * count) / 3);
    let matches = 0;
    for (let index = from; index < to; index += 1) {
      if (matched.has(index)) matches += 1;
    }
    ratios.push(matches / Math.max(1, to - from));
  }
  return { beginning: ratios[0], middle: ratios[1], end: ratios[2] };
}

export function alignCuesMonotonically(
  rawTargetCues: readonly StructuralCue[],
  rawPivotCues: readonly StructuralCue[],
  suppliedOptions: MonotonicAlignmentOptions = {},
): MonotonicAlignmentResult {
  const options: Required<MonotonicAlignmentOptions> = {
    ...DEFAULT_OPTIONS,
    ...suppliedOptions,
  };
  const targetCues = validCues(rawTargetCues);
  const pivotCues = validCues(rawPivotCues);
  if (targetCues.length === 0 || pivotCues.length === 0) {
    return emptyResult("no-valid-cues");
  }

  const n = targetCues.length;
  const m = pivotCues.length;
  const targetGroups = indexCueGroups(targetCues);
  const pivotGroups = indexCueGroups(pivotCues);
  const width = m + 1;
  const back = new Uint8Array((n + 1) * width);
  const allowed = (i: number, j: number): boolean => {
    if ((i === 0 && j === 0) || (i === n && j === m)) return true;
    const margin = 2 / Math.max(3, Math.min(n, m));
    return Math.abs(i / n - j / m) <= options.bandFraction + margin;
  };

  let previousPrevious = new Float64Array(width);
  let previous = new Float64Array(width);
  previousPrevious.fill(Infinity);
  previous.fill(Infinity);
  previous[0] = 0;
  for (let j = 1; j <= m; j += 1) {
    if (!allowed(0, j) || !Number.isFinite(previous[j - 1])) continue;
    previous[j] = previous[j - 1] + options.skipPenalty;
    back[cellIndex(0, j, width)] = 5;
  }

  for (let i = 1; i <= n; i += 1) {
    const current = new Float64Array(width);
    current.fill(Infinity);
    for (let j = 0; j <= m; j += 1) {
      if (!allowed(i, j)) continue;
      let bestCost = Infinity;
      let bestCode = 0;
      let bestPriority = Infinity;
      const consider = (cost: number, code: number, priority: number): void => {
        if (
          cost < bestCost - EPSILON ||
          (Math.abs(cost - bestCost) <= EPSILON && priority < bestPriority)
        ) {
          bestCost = cost;
          bestCode = code;
          bestPriority = priority;
        }
      };

      if (j >= 1 && Number.isFinite(previous[j - 1])) {
        consider(
          previous[j - 1] + matchCost(targetGroups.single[i - 1], pivotGroups.single[j - 1]),
          1,
          1,
        );
      }
      if (j >= 2 && Number.isFinite(previous[j - 2])) {
        consider(
          previous[j - 2] +
            matchCost(targetGroups.single[i - 1], pivotGroups.double[j - 2]) +
            options.mergePenalty,
          2,
          2,
        );
      }
      if (i >= 2 && j >= 1 && Number.isFinite(previousPrevious[j - 1])) {
        consider(
          previousPrevious[j - 1] +
            matchCost(targetGroups.double[i - 2], pivotGroups.single[j - 1]) +
            options.mergePenalty,
          3,
          3,
        );
      }
      if (Number.isFinite(previous[j])) {
        consider(previous[j] + options.skipPenalty, 4, 4);
      }
      if (j >= 1 && Number.isFinite(current[j - 1])) {
        consider(current[j - 1] + options.skipPenalty, 5, 5);
      }

      if (bestCode !== 0) {
        current[j] = bestCost;
        back[cellIndex(i, j, width)] = bestCode;
      }
    }
    previousPrevious = previous;
    previous = current;
  }

  if (!Number.isFinite(previous[m])) return emptyResult("alignment-band-has-no-path");

  const matches: MonotonicMatch[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const code = back[cellIndex(i, j, width)];
    if (code === 1 || code === 2 || code === 3) {
      const targetCount = code === 3 ? 2 : 1;
      const pivotCount = code === 2 ? 2 : 1;
      const targetFrom = i - targetCount;
      const pivotFrom = j - pivotCount;
      const cost =
        matchCost(
          targetCount === 1 ? targetGroups.single[targetFrom] : targetGroups.double[targetFrom],
          pivotCount === 1 ? pivotGroups.single[pivotFrom] : pivotGroups.double[pivotFrom],
        ) + (code === 1 ? 0 : options.mergePenalty);
      matches.push({
        targetFrom,
        targetTo: i,
        pivotFrom,
        pivotTo: j,
        transition: code === 1 ? "1:1" : code === 2 ? "1:2" : "2:1",
        cost,
        confidence: clamp01(1 - cost / (options.skipPenalty * 2)),
      });
      i -= targetCount;
      j -= pivotCount;
    } else if (code === 4) {
      i -= 1;
    } else if (code === 5) {
      j -= 1;
    } else {
      return emptyResult("alignment-backtrace-failed");
    }
  }
  matches.reverse();

  const reliableMatches = matches.filter(
    (match) => match.confidence >= options.minAnchorConfidence,
  );
  const matchedTarget = new Set<number>();
  const matchedPivot = new Set<number>();
  const anchors: TimeAnchor[] = [];
  for (const match of reliableMatches) {
    for (let index = match.targetFrom; index < match.targetTo; index += 1) {
      matchedTarget.add(index);
    }
    for (let index = match.pivotFrom; index < match.pivotTo; index += 1) {
      matchedPivot.add(index);
    }
    const target =
      match.targetTo - match.targetFrom === 1
        ? targetGroups.single[match.targetFrom]
        : targetGroups.double[match.targetFrom];
    const pivot =
      match.pivotTo - match.pivotFrom === 1
        ? pivotGroups.single[match.pivotFrom]
        : pivotGroups.double[match.pivotFrom];
    anchors.push({
      sourceSec: target.center,
      targetSec: pivot.center,
      weight: Math.max(0.1, match.confidence),
    });
  }

  const targetCoverage = matchedTarget.size / n;
  const pivotCoverage = matchedPivot.size / m;
  const regionCoverage = coverageByRegion(matchedTarget, n);
  const averageMatchCost =
    reliableMatches.length > 0
      ? reliableMatches.reduce((sum, match) => sum + match.cost, 0) / reliableMatches.length
      : Infinity;
  const regionMean = (regionCoverage.beginning + regionCoverage.middle + regionCoverage.end) / 3;
  const structuralQuality = Number.isFinite(averageMatchCost)
    ? clamp01(1 - averageMatchCost / (options.skipPenalty * 2))
    : 0;
  const confidence = clamp01(
    targetCoverage * 0.35 + pivotCoverage * 0.2 + regionMean * 0.2 + structuralQuality * 0.25,
  );
  const diagnostics: string[] = [];
  if (anchors.length < 6) diagnostics.push("sparse-anchors");
  if (Math.min(regionCoverage.beginning, regionCoverage.middle, regionCoverage.end) < 0.2) {
    diagnostics.push("missing-timeline-region");
  }
  if (targetCoverage < 0.5) diagnostics.push("low-target-coverage");

  return {
    matches,
    anchors,
    targetCoverage,
    pivotCoverage,
    regionCoverage,
    averageMatchCost,
    confidence,
    diagnostics,
  };
}
