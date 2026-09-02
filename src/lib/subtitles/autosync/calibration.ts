export type TierId =
  | "hash_exact"
  | "crowd_db"
  | "vad_affine"
  | "vad_piecewise"
  | "asr_match"
  | "consensus"
  | "metadata_prior";

export type Calibrator =
  | { kind: "identity" }
  | { kind: "platt"; a: number; b: number }
  | { kind: "isotonic"; x: number[]; p: number[] };

export type PerTierCalibration = { calibrator: Calibrator; reliability: number };

export type ThresholdSet = {
  applyExact: number;
  applyMulti: number;
  offerFloor: number;
  minImprovement: number;
};

export type CalibrationMetrics = {
  n: number;
  eceBefore: number;
  eceAfter: number;
  brierBefore: number;
  brierAfter: number;
  falseApplyUpper: number;
  appliedN: number;
  falseApplies: number;
};

export type CalibrationProvenance = {
  fittedAt: string;
  corpusTag: string;
  corpusItems: number;
  seed: number;
  method: string;
  note: string;
};

export type CalibrationBundle = {
  version: number;
  provisional: boolean;
  perTier: Record<TierId, PerTierCalibration>;
  fused: Calibrator;
  thresholds: ThresholdSet;
  metrics?: CalibrationMetrics;
  provenance?: CalibrationProvenance;
};

export type LabelledPrediction = { p: number; correct: boolean };

export type ThresholdRecord = { p: number; falseApplyIfApplied: boolean };

export type ThresholdChoice = {
  threshold: number;
  appliedN: number;
  falseApplies: number;
  wilsonUpper: number;
  coverage: number;
  meetsTarget: boolean;
};

export const EPS = 1e-4;
export const WILSON_Z = 1.96;
export const GATE_STRICT = 0.005;
export const GATE_STRETCH = 0.001;

const MIN_APPLIED_FLOOR = 30;

export function clampProb(p: number): number {
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

export function applyCalibrator(cal: Calibrator, raw: number): number {
  if (cal.kind === "platt") return plattProbability(raw, cal.a, cal.b);
  if (cal.kind === "isotonic") return isotonicProbability(raw, cal.x, cal.p);
  return clampProb(raw);
}

export function calibratorFor(bundle: CalibrationBundle, tier: TierId): Calibrator {
  return bundle.perTier[tier]?.calibrator ?? { kind: "identity" };
}

export function reliabilityFor(bundle: CalibrationBundle, tier: TierId): number {
  return clamp01(bundle.perTier[tier]?.reliability ?? 0.5);
}

export function applyFusedCalibration(bundle: CalibrationBundle, rawFusedProb: number): number {
  return applyCalibrator(bundle.fused, rawFusedProb);
}

export function thresholdsFor(bundle: CalibrationBundle): ThresholdSet {
  return bundle.thresholds;
}

export function wilsonUpper(x: number, n: number, z: number = WILSON_Z): number {
  if (n === 0) return 1;
  const phat = x / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n));
  return Math.min(1, center + margin);
}

export function requiredNForTarget(target: number, z: number = WILSON_Z): number {
  let n = 1;
  while (n < 1e7 && wilsonUpper(0, n, z) >= target) n *= 2;
  let lo = Math.floor(n / 2);
  let hi = n;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (wilsonUpper(0, mid, z) < target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function brier(records: LabelledPrediction[]): number {
  if (records.length === 0) return 0;
  let sum = 0;
  for (const r of records) {
    const y = r.correct ? 1 : 0;
    const d = clampProb(r.p) - y;
    sum += d * d;
  }
  return sum / records.length;
}

export type ReliabilityBin = {
  lo: number;
  hi: number;
  n: number;
  meanConf: number;
  meanAcc: number;
};

export function reliabilityBins(
  records: LabelledPrediction[],
  bins = 10,
  mode: "width" | "mass" = "width",
): ReliabilityBin[] {
  if (records.length === 0) return [];
  if (mode === "mass") {
    const sorted = [...records].sort((a, b) => a.p - b.p);
    const out: ReliabilityBin[] = [];
    const per = Math.max(1, Math.ceil(sorted.length / bins));
    for (let i = 0; i < sorted.length; i += per) {
      const chunk = sorted.slice(i, i + per);
      const conf = chunk.reduce((s, r) => s + clampProb(r.p), 0) / chunk.length;
      const acc = chunk.reduce((s, r) => s + (r.correct ? 1 : 0), 0) / chunk.length;
      out.push({
        lo: chunk[0].p,
        hi: chunk[chunk.length - 1].p,
        n: chunk.length,
        meanConf: conf,
        meanAcc: acc,
      });
    }
    return out;
  }
  const buckets = Array.from({ length: bins }, (_, i) => ({
    lo: i / bins,
    hi: (i + 1) / bins,
    n: 0,
    conf: 0,
    acc: 0,
  }));
  for (const r of records) {
    const p = clampProb(r.p);
    const idx = Math.min(bins - 1, Math.floor(p * bins));
    buckets[idx].n += 1;
    buckets[idx].conf += p;
    buckets[idx].acc += r.correct ? 1 : 0;
  }
  return buckets
    .filter((b) => b.n > 0)
    .map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, meanConf: b.conf / b.n, meanAcc: b.acc / b.n }));
}

export function expectedCalibrationError(
  records: LabelledPrediction[],
  bins = 10,
  mode: "width" | "mass" = "width",
): number {
  const total = records.length;
  if (total === 0) return 0;
  const bs = reliabilityBins(records, bins, mode);
  return bs.reduce((acc, b) => acc + (b.n / total) * Math.abs(b.meanConf - b.meanAcc), 0);
}

export function maxCalibrationError(
  records: LabelledPrediction[],
  bins = 10,
  mode: "width" | "mass" = "width",
): number {
  const bs = reliabilityBins(records, bins, mode);
  return bs.reduce((m, b) => Math.max(m, Math.abs(b.meanConf - b.meanAcc)), 0);
}

export function selectApplyThreshold(
  records: ThresholdRecord[],
  target: number = GATE_STRICT,
  z: number = WILSON_Z,
): ThresholdChoice {
  const total = records.length;
  if (total === 0) {
    return {
      threshold: 1,
      appliedN: 0,
      falseApplies: 0,
      wilsonUpper: 1,
      coverage: 0,
      meetsTarget: false,
    };
  }
  const candidates = Array.from(new Set(records.map((r) => clampProb(r.p)))).sort((a, b) => a - b);
  let valid: ThresholdChoice | null = null;
  let safest: ThresholdChoice | null = null;
  for (const tau of candidates) {
    let n = 0;
    let x = 0;
    for (const r of records) {
      if (clampProb(r.p) >= tau) {
        n += 1;
        if (r.falseApplyIfApplied) x += 1;
      }
    }
    const upper = wilsonUpper(x, n, z);
    const choice: ThresholdChoice = {
      threshold: tau,
      appliedN: n,
      falseApplies: x,
      wilsonUpper: upper,
      coverage: n / total,
      meetsTarget: upper < target && n >= MIN_APPLIED_FLOOR,
    };
    if (choice.meetsTarget && (!valid || choice.appliedN > valid.appliedN)) valid = choice;
    if (!safest || upper < safest.wilsonUpper) safest = choice;
  }
  return valid ?? { ...(safest as ThresholdChoice), meetsTarget: false };
}

export function evaluateBundleThreshold(
  records: ThresholdRecord[],
  threshold: number,
  z: number = WILSON_Z,
): ThresholdChoice {
  let n = 0;
  let x = 0;
  for (const r of records) {
    if (clampProb(r.p) >= threshold) {
      n += 1;
      if (r.falseApplyIfApplied) x += 1;
    }
  }
  const upper = wilsonUpper(x, n, z);
  return {
    threshold,
    appliedN: n,
    falseApplies: x,
    wilsonUpper: upper,
    coverage: records.length ? n / records.length : 0,
    meetsTarget: upper < GATE_STRICT && n >= MIN_APPLIED_FLOOR,
  };
}

export function isReleaseReady(bundle: CalibrationBundle): boolean {
  if (bundle.provisional) return false;
  const m = bundle.metrics;
  if (!m) return false;
  return m.falseApplies === 0 ? m.falseApplyUpper < GATE_STRICT : m.falseApplyUpper < GATE_STRICT;
}

export const DEFAULT_BUNDLE: CalibrationBundle = {
  version: 0,
  provisional: true,
  perTier: {
    hash_exact: { calibrator: { kind: "identity" }, reliability: 0.99 },
    crowd_db: { calibrator: { kind: "identity" }, reliability: 0.9 },
    vad_affine: { calibrator: { kind: "platt", a: 8.8, b: -4.8 }, reliability: 0.75 },
    vad_piecewise: { calibrator: { kind: "platt", a: 8.0, b: -4.4 }, reliability: 0.7 },
    asr_match: { calibrator: { kind: "platt", a: 9.8, b: -3.7 }, reliability: 0.85 },
    consensus: { calibrator: { kind: "platt", a: 6, b: -3 }, reliability: 0.6 },
    metadata_prior: { calibrator: { kind: "identity" }, reliability: 0.4 },
  },
  fused: { kind: "identity" },
  thresholds: { applyExact: 0.97, applyMulti: 0.9, offerFloor: 0.65, minImprovement: 0.08 },
  provenance: {
    fittedAt: "n/a",
    corpusTag: "none",
    corpusItems: 0,
    seed: 0,
    method: "hand-set-provisional",
    note: "Hand-set provisional values. Runtime safety caps structural decisions at offer until a release-ready bundle is supplied.",
  },
};

export function loadBundle(raw: unknown): CalibrationBundle {
  const b = raw as Partial<CalibrationBundle> | null;
  if (!b || typeof b !== "object" || !b.perTier || !b.thresholds || !b.fused) return DEFAULT_BUNDLE;
  return {
    version: b.version ?? 0,
    provisional: b.provisional ?? true,
    perTier: { ...DEFAULT_BUNDLE.perTier, ...b.perTier },
    fused: b.fused,
    thresholds: { ...DEFAULT_BUNDLE.thresholds, ...b.thresholds },
    metrics: b.metrics,
    provenance: b.provenance,
  };
}
