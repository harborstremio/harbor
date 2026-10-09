export type TierId =
  | "hash_exact"
  | "crowd_db"
  | "vad_affine"
  | "vad_piecewise"
  | "asr_match"
  | "consensus"
  | "metadata_prior";

export type CrowdTier = "A" | "B" | "C";

export type Calibrator =
  | { kind: "identity" }
  | { kind: "platt"; a: number; b: number }
  | { kind: "isotonic"; x: number[]; p: number[] };

export type SignalEvidence = {
  tier: TierId;
  rawScore: number;
  calibrator: Calibrator;
  reliability: number;
  independenceGroup: string;
  clearedFloor: boolean;
  supportsWrong?: number;
  crowdTier?: CrowdTier;
};

export type TierContribution = {
  tier: TierId;
  pCorrect: number;
  weightedLogOdds: number;
  group: string;
  isRepresentative: boolean;
};

export type FusedConfidence = {
  pCorrect: number;
  logOdds: number;
  conflictK: number;
  agreeingSignals: number;
  perTier: TierContribution[];
};

export const DEFAULT_PRIOR = 0.5;

const EPS = 1e-4;
const MAX_TERM_LOGIT = 8;
const MAX_FUSED_LOGIT = 9.2;
const AGREE_P = 0.5;

export function isTimingGroup(group: string): boolean {
  return group === "hash" || group === "crowd" || group === "vad" || group === "asr" || group === "consensus";
}

export function isAgreeingSignal(s: SignalEvidence): boolean {
  if (!isTimingGroup(s.independenceGroup) || !s.clearedFloor) return false;
  if (s.independenceGroup === "crowd" && s.crowdTier === "C") return false;
  return true;
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - EPS, Math.max(EPS, p));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function sigmoid(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}

export function toLogOdds(p: number): number {
  const c = clampProb(p);
  return Math.log(c / (1 - c));
}

export function fromLogOdds(l: number): number {
  return sigmoid(l);
}

function plattProbability(raw: number, a: number, b: number): number {
  return clampProb(sigmoid(a * raw + b));
}

function isotonicProbability(raw: number, xs: number[], ps: number[]): number {
  const n = xs.length;
  if (n === 0) return 0.5;
  if (raw <= xs[0]) return clampProb(ps[0]);
  if (raw >= xs[n - 1]) return clampProb(ps[n - 1]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= raw) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo] || 1;
  const t = (raw - xs[lo]) / span;
  return clampProb(ps[lo] + t * (ps[hi] - ps[lo]));
}

export function calibrate(cal: Calibrator, raw: number): number {
  if (cal.kind === "platt") return plattProbability(raw, cal.a, cal.b);
  if (cal.kind === "isotonic") return isotonicProbability(raw, cal.x, cal.p);
  return clampProb(raw);
}

type GroupMass = {
  group: string;
  correct: number;
  wrong: number;
  unknown: number;
  pCorrect: number;
  cleared: boolean;
  agreeing: boolean;
};

function bestByGroup(evidence: SignalEvidence[], priorLogit: number): Map<string, SignalEvidence> {
  const best = new Map<string, SignalEvidence>();
  const swing = (s: SignalEvidence) =>
    Math.abs((toLogOdds(calibrate(s.calibrator, s.rawScore)) - priorLogit) * clamp01(s.reliability));
  for (const s of evidence) {
    const cur = best.get(s.independenceGroup);
    if (!cur || swing(s) > swing(cur)) best.set(s.independenceGroup, s);
  }
  return best;
}

function groupMass(s: SignalEvidence): GroupMass {
  const p = calibrate(s.calibrator, s.rawScore);
  const r = clamp01(s.reliability);
  let correct = r * p;
  let wrong = r * (1 - p);
  let unknown = 1 - r;
  const against = clamp01(s.supportsWrong ?? 0);
  const shift = against * unknown;
  wrong += shift;
  unknown -= shift;
  return {
    group: s.independenceGroup,
    correct,
    wrong,
    unknown,
    pCorrect: p,
    cleared: s.clearedFloor,
    agreeing: isAgreeingSignal(s),
  };
}

function pairwiseConflict(a: GroupMass, b: GroupMass): number {
  return a.correct * b.wrong + a.wrong * b.correct;
}

export function fuseConfidence(
  evidence: SignalEvidence[],
  prior: number = DEFAULT_PRIOR,
): FusedConfidence {
  const priorLogit = toLogOdds(prior);
  const reps = bestByGroup(evidence, priorLogit);

  const perTier: TierContribution[] = evidence.map((s) => {
    const p = calibrate(s.calibrator, s.rawScore);
    const term = (toLogOdds(p) - priorLogit) * clamp01(s.reliability);
    const bounded = Math.max(-MAX_TERM_LOGIT, Math.min(MAX_TERM_LOGIT, term));
    return {
      tier: s.tier,
      pCorrect: p,
      weightedLogOdds: bounded,
      group: s.independenceGroup,
      isRepresentative: reps.get(s.independenceGroup) === s,
    };
  });

  const summed = perTier
    .filter((c) => c.isRepresentative)
    .reduce((acc, c) => acc + (isTimingGroup(c.group) ? c.weightedLogOdds : Math.min(0, c.weightedLogOdds)), priorLogit);
  const logOdds = Math.max(-MAX_FUSED_LOGIT, Math.min(MAX_FUSED_LOGIT, summed));
  const pCorrect = fromLogOdds(logOdds);

  const masses = [...reps.values()].map(groupMass);
  const agreeingSignals = masses.filter((m) => m.agreeing && m.pCorrect >= AGREE_P).length;

  let conflictK = 0;
  for (let i = 0; i < masses.length; i += 1) {
    for (let j = i + 1; j < masses.length; j += 1) {
      conflictK = Math.max(conflictK, pairwiseConflict(masses[i], masses[j]));
    }
  }

  return { pCorrect, logOdds, conflictK, agreeingSignals, perTier };
}

export function brierScore(predictions: Array<{ p: number; correct: boolean }>): number {
  if (predictions.length === 0) return 0;
  const sum = predictions.reduce((acc, r) => {
    const y = r.correct ? 1 : 0;
    const d = clampProb(r.p) - y;
    return acc + d * d;
  }, 0);
  return sum / predictions.length;
}

export function expectedCalibrationError(
  predictions: Array<{ p: number; correct: boolean }>,
  bins = 10,
): number {
  if (predictions.length === 0) return 0;
  const buckets = Array.from({ length: bins }, () => ({ n: 0, conf: 0, acc: 0 }));
  for (const r of predictions) {
    const p = clampProb(r.p);
    const idx = Math.min(bins - 1, Math.floor(p * bins));
    buckets[idx].n += 1;
    buckets[idx].conf += p;
    buckets[idx].acc += r.correct ? 1 : 0;
  }
  const total = predictions.length;
  return buckets.reduce((acc, b) => {
    if (b.n === 0) return acc;
    const meanConf = b.conf / b.n;
    const meanAcc = b.acc / b.n;
    return acc + (b.n / total) * Math.abs(meanConf - meanAcc);
  }, 0);
}
