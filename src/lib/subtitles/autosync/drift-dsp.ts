import { DEFAULT_BOUNDS, type Bounds, type AlignmentQuality } from "./fp-gate";
import type { SignalEvidence, Calibrator } from "./confidence";
import type { SubCue } from "@/lib/subtitles/parser";

export type Interval = [number, number];

export type DriftConfig = {
  sampleWindowSec: number;
  samplePeriodSec: number;
  windowLeadSec: number;
  gridHz: number;
  maxLagSec: number;
  deadbandSec: number;
  stepCapSec: number;
  cumulativeCapSec: number;
  dampingFactor: number;
  stableSamples: number;
  stabilityWindowSec: number;
  stabilityMadSec: number;
  cooldownSec: number;
  minSpeechFrac: number;
  minNcc: number;
  minCoverage: number;
  minDominance: number;
  crossCheckTolSec: number;
  asrAgreeTolSec: number;
  maxReversals: number;
  reversalWindowSec: number;
  seekTolSec: number;
  externalDelayEpsSec: number;
  rollingQualitySec: number;
};

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  sampleWindowSec: 30,
  samplePeriodSec: 20,
  windowLeadSec: 2,
  gridHz: 50,
  maxLagSec: 2.5,
  deadbandSec: 0.25,
  stepCapSec: 1.0,
  cumulativeCapSec: 2.0,
  dampingFactor: 0.85,
  stableSamples: 3,
  stabilityWindowSec: 120,
  stabilityMadSec: 0.12,
  cooldownSec: 30,
  minSpeechFrac: 0.08,
  minNcc: 0.55,
  minCoverage: 0.5,
  minDominance: 1.3,
  crossCheckTolSec: 0.2,
  asrAgreeTolSec: 0.25,
  maxReversals: 2,
  reversalWindowSec: 240,
  seekTolSec: 2.0,
  externalDelayEpsSec: 0.02,
  rollingQualitySec: 90,
};

export type LocalFit = {
  lagSec: number;
  ncc: number;
  coverage: number;
  dominance: number;
  z: number;
};

export type DriftSample = {
  playbackSec: number;
  residualSec: number;
  fit: LocalFit;
  speechFrac: number;
  speech: Interval[];
  cues: SubCue[];
  delayAtFit: number;
  window: Interval;
  usable: boolean;
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function robustMedian(v: number[]): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mad(v: number[]): number {
  if (v.length === 0) return 0;
  const m = robustMedian(v);
  return robustMedian(v.map((x) => Math.abs(x - m)));
}

function maskSpeech(speech: Interval[], w0: number, n: number, gridHz: number): Float32Array {
  const out = new Float32Array(n);
  for (const [a, b] of speech) {
    const lo = Math.max(0, Math.ceil((a - w0) * gridHz - 0.5));
    const hi = Math.min(n - 1, Math.floor((b - w0) * gridHz - 0.5));
    for (let i = lo; i <= hi; i += 1) out[i] = 1;
  }
  return out;
}

function maskCues(cues: SubCue[], delaySec: number, w0: number, n: number, gridHz: number): Float32Array {
  const out = new Float32Array(n);
  for (const c of cues) {
    const a = c.start + delaySec;
    const b = c.end + delaySec;
    const lo = Math.max(0, Math.ceil((a - w0) * gridHz - 0.5));
    const hi = Math.min(n - 1, Math.floor((b - w0) * gridHz - 0.5));
    for (let i = lo; i <= hi; i += 1) out[i] = 1;
  }
  return out;
}

function nccCoverageAtShift(speech: Float32Array, cue: Float32Array, shift: number): { ncc: number; coverage: number } {
  const n = speech.length;
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (let i = 0; i < n; i += 1) {
    const j = i - shift;
    if (j < 0 || j >= n) continue;
    sx += speech[i];
    sy += cue[j];
    cnt += 1;
  }
  if (cnt === 0) return { ncc: 0, coverage: 0 };
  const mx = sx / cnt;
  const my = sy / cnt;
  let num = 0;
  let dxx = 0;
  let dyy = 0;
  let onCue = 0;
  let onBoth = 0;
  for (let i = 0; i < n; i += 1) {
    const j = i - shift;
    if (j < 0 || j >= n) continue;
    const dx = speech[i] - mx;
    const dy = cue[j] - my;
    num += dx * dy;
    dxx += dx * dx;
    dyy += dy * dy;
    if (cue[j] > 0) {
      onCue += 1;
      if (speech[i] > 0) onBoth += 1;
    }
  }
  const den = Math.sqrt(dxx * dyy);
  const ncc = den > 0 ? num / den : 0;
  const coverage = onCue > 0 ? onBoth / onCue : 0;
  return { ncc, coverage };
}

export function localFit(
  speech: Interval[],
  cues: SubCue[],
  delaySec: number,
  window: Interval,
  cfg: DriftConfig,
): LocalFit {
  const [w0, w1] = window;
  const n = Math.max(1, Math.round((w1 - w0) * cfg.gridHz));
  const sMask = maskSpeech(speech, w0, n, cfg.gridHz);
  const cMask = maskCues(cues, delaySec, w0, n, cfg.gridHz);
  const maxShift = Math.round(cfg.maxLagSec * cfg.gridHz);
  let bestShift = 0;
  let bestNcc = -Infinity;
  let bestCov = 0;
  const curve: number[] = [];
  for (let sh = -maxShift; sh <= maxShift; sh += 1) {
    const { ncc, coverage } = nccCoverageAtShift(sMask, cMask, sh);
    curve.push(ncc);
    if (ncc > bestNcc) {
      bestNcc = ncc;
      bestShift = sh;
      bestCov = coverage;
    }
  }
  const guard = Math.round(0.4 * cfg.gridHz);
  let runnerUp = -Infinity;
  for (let k = 0; k < curve.length; k += 1) {
    const sh = k - maxShift;
    if (Math.abs(sh - bestShift) <= guard) continue;
    if (curve[k] > runnerUp) runnerUp = curve[k];
  }
  const mean = curve.reduce((s, x) => s + x, 0) / curve.length;
  const variance = curve.reduce((s, x) => s + (x - mean) * (x - mean), 0) / curve.length;
  const std = Math.sqrt(variance) || 1e-6;
  const dominance = runnerUp > 0 ? Math.max(0, bestNcc) / runnerUp : bestNcc > 0 ? 3 : 0;
  return {
    lagSec: bestShift / cfg.gridHz,
    ncc: Math.max(0, bestNcc),
    coverage: bestCov,
    dominance,
    z: (bestNcc - mean) / std,
  };
}

export function onsetResidual(speech: Interval[], cues: SubCue[], delaySec: number, window: Interval, bandSec: number): number {
  const [w0, w1] = window;
  const starts = speech.map((s) => s[0]).filter((t) => t >= w0 - bandSec && t <= w1 + bandSec);
  if (starts.length === 0) return NaN;
  const deltas: number[] = [];
  for (const c of cues) {
    const cs = c.start + delaySec;
    if (cs < w0 - bandSec || cs > w1 + bandSec) continue;
    let best = NaN;
    let bestD = bandSec;
    for (const st of starts) {
      const d = Math.abs(st - cs);
      if (d <= bestD) {
        bestD = d;
        best = st - cs;
      }
    }
    if (Number.isFinite(best)) deltas.push(best);
  }
  return deltas.length >= 3 ? robustMedian(deltas) : NaN;
}

export function speechFraction(speech: Interval[], window: Interval): number {
  const [w0, w1] = window;
  const span = Math.max(1e-6, w1 - w0);
  let sum = 0;
  for (const [a, b] of speech) sum += Math.max(0, Math.min(b, w1) - Math.max(a, w0));
  return clamp(sum / span, 0, 1);
}

export function aggregateQuality(samples: DriftSample[], extraLagSec: number, cfg: DriftConfig): AlignmentQuality {
  let wNcc = 0;
  let wCov = 0;
  let wZ = 0;
  let wSum = 0;
  for (const s of samples) {
    const [w0, w1] = s.window;
    const n = Math.max(1, Math.round((w1 - w0) * cfg.gridHz));
    const sMask = maskSpeech(s.speech, w0, n, cfg.gridHz);
    const cMask = maskCues(s.cues, s.delayAtFit, w0, n, cfg.gridHz);
    const shift = Math.round(extraLagSec * cfg.gridHz);
    const { ncc, coverage } = nccCoverageAtShift(sMask, cMask, shift);
    const weight = Math.max(0.05, s.speechFrac);
    wNcc += ncc * weight;
    wCov += coverage * weight;
    wZ += s.fit.z * weight;
    wSum += weight;
  }
  if (wSum === 0) return { ncc: 0, coverage: 0, z: 0 };
  return { ncc: wNcc / wSum, coverage: wCov / wSum, z: wZ / wSum };
}

export function onlineBounds(cfg: DriftConfig): Bounds {
  return {
    ...DEFAULT_BOUNDS,
    maxOffsetSec: cfg.stepCapSec + 0.01,
    hardOffsetCapSec: cfg.stepCapSec * 2,
  };
}

export function vadReliability(fit: LocalFit, speechFrac: number): number {
  let r = 0.62;
  if (speechFrac < 0.15) r -= 0.15;
  if (fit.dominance < 1.6) r -= 0.1;
  if (fit.z < 4) r -= 0.1;
  return clamp(r, 0.1, 0.75);
}

export function stableCandidate(
  samples: DriftSample[],
  atPlaybackSec: number,
  cfg: DriftConfig,
): { residualSec: number; members: DriftSample[] } | null {
  const recent = samples.filter(
    (s) => s.usable && atPlaybackSec - s.playbackSec <= cfg.stabilityWindowSec,
  );
  if (recent.length < cfg.stableSamples) return null;
  const members = recent.slice(-cfg.stableSamples);
  const residuals = members.map((m) => m.residualSec);
  const sign = Math.sign(residuals[0]);
  if (sign === 0) return null;
  if (!residuals.every((r) => Math.sign(r) === sign)) return null;
  if (mad(residuals) > cfg.stabilityMadSec) return null;
  const median = robustMedian(residuals);
  if (Math.abs(median) < cfg.deadbandSec) return null;
  return { residualSec: median, members };
}

export const VAD_CAL: Calibrator = { kind: "platt", a: 8.8, b: -4.8 };
export const ASR_CAL: Calibrator = { kind: "platt", a: 9.8, b: -3.7 };

export function driftStep(residualSec: number, cfg: DriftConfig): number {
  return clamp(residualSec * cfg.dampingFactor, -cfg.stepCapSec, cfg.stepCapSec);
}

export function vadEvidence(fit: LocalFit, speechFrac: number, cfg: DriftConfig): SignalEvidence {
  const cleared = fit.ncc >= cfg.minNcc && fit.coverage >= cfg.minCoverage && fit.dominance >= cfg.minDominance;
  return {
    tier: "vad_affine",
    rawScore: fit.ncc,
    calibrator: VAD_CAL,
    reliability: vadReliability(fit, speechFrac),
    independenceGroup: "vad",
    clearedFloor: cleared,
  };
}

export function asrEvidence(
  asrResidualSec: number,
  asrWordMatch: number,
  candidateResidualSec: number,
  cfg: DriftConfig,
): SignalEvidence {
  const agree = Math.abs(asrResidualSec - candidateResidualSec) <= cfg.asrAgreeTolSec;
  return {
    tier: "asr_match",
    rawScore: agree ? asrWordMatch : Math.min(asrWordMatch, 0.1),
    calibrator: ASR_CAL,
    reliability: 0.85,
    independenceGroup: "asr",
    clearedFloor: asrWordMatch >= 0.2,
    supportsWrong: agree ? 1 - asrWordMatch : Math.max(0.5, 1 - asrWordMatch),
  };
}

export function sampleUsable(
  fit: LocalFit,
  speechFrac: number,
  cueCount: number,
  onsetSec: number,
  cfg: DriftConfig,
): boolean {
  const crossCheckOk = Number.isFinite(onsetSec) && Math.abs(onsetSec - fit.lagSec) <= cfg.crossCheckTolSec;
  return (
    speechFrac >= cfg.minSpeechFrac &&
    cueCount >= 3 &&
    fit.ncc >= cfg.minNcc &&
    fit.coverage >= cfg.minCoverage &&
    fit.dominance >= cfg.minDominance &&
    crossCheckOk
  );
}
