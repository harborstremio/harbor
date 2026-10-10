export type BandPeaks = {
  columns: number;
  perSecond: number;
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  level: Float32Array;
};

export type BeatGrid = {
  bpm: number;
  period: number;
  origin: number;
  confidence: number;
};

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };
type Cell = { x1: number; x2: number; y1: number; y2: number };

export const COLUMNS_PER_SECOND = 64;
export const GRID_MIN_CONFIDENCE = 0.34;

const LOW_HZ = 200;
const HIGH_HZ = 2000;
const Q = 0.707;
const MIN_BPM = 72;
const MAX_BPM = 176;
const PRIOR_BPM = 124;
const PRIOR_WIDTH = 0.55;
const FLUX_WINDOW = 33;
const HARMONIC_TWO = 0.5;
const HARMONIC_THREE = 0.9;
const RATIOS = [1, 2 / 3, 3 / 2, 2, 0.5];
const COARSE_PHASES = 32;
const COARSE_STEP = 0.12;
const PHASE_STEPS = 64;
const ORIGIN_STEPS = 96;
const PERIOD_REACH = 0.9;
const PERIOD_STEP = 0.03;
const LOCAL_SECONDS = 14;
const MIN_ANALYSIS_SECONDS = 20;

function lowpass(freq: number, rate: number): Biquad {
  const w = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
  const cosine = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Q);
  const a0 = 1 + alpha;
  const shared = (1 - cosine) / 2 / a0;
  const a1 = (-2 * cosine) / a0;
  return { b0: shared, b1: (1 - cosine) / a0, b2: shared, a1, a2: (1 - alpha) / a0 };
}

function highpass(freq: number, rate: number): Biquad {
  const w = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
  const cosine = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Q);
  const a0 = 1 + alpha;
  const shared = (1 + cosine) / 2 / a0;
  const a1 = (-2 * cosine) / a0;
  return { b0: shared, b1: -(1 + cosine) / a0, b2: shared, a1, a2: (1 - alpha) / a0 };
}

function step(filter: Biquad, cell: Cell, x: number): number {
  const y =
    filter.b0 * x +
    filter.b1 * cell.x1 +
    filter.b2 * cell.x2 -
    filter.a1 * cell.y1 -
    filter.a2 * cell.y2;
  cell.x2 = cell.x1;
  cell.x1 = x;
  cell.y2 = cell.y1;
  cell.y1 = y;
  return y;
}

export function createPeaks(duration: number): BandPeaks {
  const columns = Math.max(1, Math.ceil(duration * COLUMNS_PER_SECOND));
  return {
    columns,
    perSecond: COLUMNS_PER_SECOND,
    low: new Float32Array(columns),
    mid: new Float32Array(columns),
    high: new Float32Array(columns),
    level: new Float32Array(columns),
  };
}

export function fillPeaks(
  peaks: BandPeaks,
  frames: Float32Array,
  rate: number,
  startColumn: number,
): number {
  const count = Math.floor(frames.length / 2);
  if (count < 2 || rate <= 0) return 0;
  const lowFilter = lowpass(LOW_HZ, rate);
  const highFilter = highpass(HIGH_HZ, rate);
  const midOpen = highpass(LOW_HZ, rate);
  const midClose = lowpass(HIGH_HZ, rate);
  const cells: Cell[] = [];
  for (let index = 0; index < 6; index += 1) cells.push({ x1: 0, x2: 0, y1: 0, y2: 0 });
  const per = rate / peaks.perSecond;
  let column = startColumn;
  let written = 0;
  let sumLow = 0;
  let sumMid = 0;
  let sumHigh = 0;
  let sumAll = 0;
  let taken = 0;
  let edge = per;
  for (let index = 0; index < count; index += 1) {
    const sample = (frames[index * 2] + frames[index * 2 + 1]) * 0.5;
    const low = step(lowFilter, cells[1], step(lowFilter, cells[0], sample));
    const mid = step(midClose, cells[3], step(midOpen, cells[2], sample));
    const high = step(highFilter, cells[5], step(highFilter, cells[4], sample));
    sumLow += low * low;
    sumMid += mid * mid;
    sumHigh += high * high;
    sumAll += sample * sample;
    taken += 1;
    if (index + 1 < edge) continue;
    if (column >= 0 && column < peaks.columns && taken > 0) {
      peaks.low[column] = Math.sqrt(sumLow / taken);
      peaks.mid[column] = Math.sqrt(sumMid / taken);
      peaks.high[column] = Math.sqrt(sumHigh / taken);
      peaks.level[column] = Math.sqrt(sumAll / taken);
      written += 1;
    }
    column += 1;
    sumLow = 0;
    sumMid = 0;
    sumHigh = 0;
    sumAll = 0;
    taken = 0;
    edge += per;
  }
  return written;
}

export function levelScale(peaks: BandPeaks, filled: number): number {
  if (filled <= 0) return 1;
  let top = 0;
  for (let index = 0; index < filled; index += 1) {
    if (peaks.level[index] > top) top = peaks.level[index];
  }
  if (top <= 0) return 1;
  const buckets = new Int32Array(64);
  for (let index = 0; index < filled; index += 1) {
    buckets[Math.min(63, Math.floor((peaks.level[index] / top) * 64))] += 1;
  }
  const target = filled * 0.97;
  let seen = 0;
  for (let bucket = 0; bucket < 64; bucket += 1) {
    seen += buckets[bucket];
    if (seen >= target) return Math.max(1e-4, ((bucket + 1) / 64) * top);
  }
  return top;
}

export function onsetEnvelope(peaks: BandPeaks, filled: number): Float32Array {
  const env = new Float32Array(Math.max(0, filled));
  if (filled <= 1) return env;
  let lastLow = 0;
  let lastMid = 0;
  let lastHigh = 0;
  for (let index = 0; index < filled; index += 1) {
    const low = Math.log1p(peaks.low[index] * 120);
    const mid = Math.log1p(peaks.mid[index] * 120);
    const high = Math.log1p(peaks.high[index] * 120);
    if (index > 0) {
      env[index] =
        Math.max(0, low - lastLow) * 1.4 +
        Math.max(0, mid - lastMid) +
        Math.max(0, high - lastHigh) * 0.9;
    }
    lastLow = low;
    lastMid = mid;
    lastHigh = high;
  }
  const half = Math.floor(FLUX_WINDOW / 2);
  const floor = new Float32Array(filled);
  let running = 0;
  for (let index = 0; index < filled; index += 1) {
    running += env[index];
    if (index >= FLUX_WINDOW) running -= env[index - FLUX_WINDOW];
    const centre = index - half;
    if (centre >= 0) floor[centre] = running / Math.min(FLUX_WINDOW, index + 1);
  }
  const tail = Math.max(0, filled - half);
  for (let index = tail; index < filled; index += 1) floor[index] = floor[Math.max(0, tail - 1)];
  let top = 0;
  for (let index = 0; index < filled; index += 1) {
    const value = Math.max(0, env[index] - floor[index]);
    env[index] = value;
    if (value > top) top = value;
  }
  if (top > 0) for (let index = 0; index < filled; index += 1) env[index] /= top;
  return env;
}

function pulseMean(
  env: Float32Array,
  from: number,
  to: number,
  period: number,
  phase: number,
  tolerance: number,
): number {
  if (!(period > 1)) return 0;
  let at = phase;
  if (at < from) at += Math.ceil((from - at) / period) * period;
  let sum = 0;
  let pulses = 0;
  for (; at < to - 1; at += period) {
    const index = Math.floor(at);
    if (index < 0) continue;
    const frac = at - index;
    let value = env[index] * (1 - frac) + env[index + 1] * frac;
    for (let reach = 1; reach <= tolerance; reach += 1) {
      const back = index - reach;
      const ahead = index + 1 + reach;
      if (back >= from && env[back] > value) value = env[back];
      if (ahead < to && env[ahead] > value) value = env[ahead];
    }
    sum += value;
    pulses += 1;
  }
  return pulses > 0 ? sum / pulses : 0;
}

type CombPick = { score: number; period: number; phase: number; mean: number };

function combBest(
  env: Float32Array,
  filled: number,
  centre: number,
  reach: number,
  periodStep: number,
  phases: number,
  tolerance: number,
): CombPick {
  let score = -1;
  let period = centre;
  let phase = 0;
  let sum = 0;
  let count = 0;
  for (let probe = centre - reach; probe <= centre + reach; probe += periodStep) {
    if (probe < 2) continue;
    for (let slot = 0; slot < phases; slot += 1) {
      const at = (slot / phases) * probe;
      const value = pulseMean(env, 0, filled, probe, at, tolerance);
      sum += value;
      count += 1;
      if (value > score) {
        score = value;
        period = probe;
        phase = at;
      }
    }
  }
  return { score, period, phase, mean: count > 0 ? sum / count : 0 };
}

function bpmPrior(bpm: number): number {
  const ratio = Math.log2(bpm / PRIOR_BPM) / PRIOR_WIDTH;
  return Math.exp(-0.5 * ratio * ratio);
}

function autocorrelation(env: Float32Array, filled: number, maxLag: number): Float32Array {
  const out = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let index = lag; index < filled; index += 1) sum += env[index] * env[index - lag];
    out[lag] = sum / Math.max(1, filled - lag);
  }
  return out;
}

export function detectGrid(env: Float32Array, scope: number): BeatGrid | null {
  const filled = Math.min(scope, env.length);
  if (filled < COLUMNS_PER_SECOND * MIN_ANALYSIS_SECONDS) return null;
  const minLag = Math.floor((60 / MAX_BPM) * COLUMNS_PER_SECOND);
  const maxLag = Math.ceil((60 / MIN_BPM) * COLUMNS_PER_SECOND);
  const reach = Math.min(filled - 2, maxLag * 3);
  if (reach <= maxLag) return null;
  const ac = autocorrelation(env, filled, reach);
  const at = (lag: number) => (lag <= reach ? ac[lag] : 0);
  let bestLag = 0;
  let bestWeight = 0;
  let weightSum = 0;
  let weightCount = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const stacked = at(lag) + HARMONIC_TWO * at(lag * 2) + HARMONIC_THREE * at(lag * 3);
    const weight = stacked * bpmPrior((60 * COLUMNS_PER_SECOND) / lag);
    weightSum += weight;
    weightCount += 1;
    if (weight > bestWeight) {
      bestWeight = weight;
      bestLag = lag;
    }
  }
  if (bestLag === 0 || bestWeight <= 0 || weightCount === 0) return null;
  const weightMean = weightSum / weightCount;
  const lock = (bestWeight - weightMean) / (bestWeight + weightMean);

  let chosen = 0;
  let chosenWeight = 0;
  for (const ratio of RATIOS) {
    const centre = bestLag * ratio;
    if (centre < minLag || centre > maxLag) continue;
    const probe = combBest(env, filled, centre, PERIOD_REACH, COARSE_STEP, COARSE_PHASES, 1);
    if (probe.score <= 0) continue;
    const weight = probe.score * bpmPrior((60 * COLUMNS_PER_SECOND) / probe.period);
    if (weight > chosenWeight) {
      chosenWeight = weight;
      chosen = probe.period;
    }
  }
  if (chosen <= 0) return null;
  const fine = combBest(env, filled, chosen, PERIOD_REACH * 0.5, PERIOD_STEP, PHASE_STEPS, 0);
  if (fine.score <= 0) return null;
  const sharp = (fine.score - fine.mean) / (fine.score + fine.mean);
  const period = fine.period / COLUMNS_PER_SECOND;
  return {
    bpm: Math.round((60 / period) * 10) / 10,
    period,
    origin: fine.phase / COLUMNS_PER_SECOND,
    confidence: Math.max(0, Math.min(1, (lock + sharp) * 0.6)),
  };
}

export function refineOrigin(
  env: Float32Array,
  filled: number,
  period: number,
  origin: number,
  centre: number,
): number {
  const columns = period * COLUMNS_PER_SECOND;
  if (!(columns > 2)) return origin;
  const bound = Math.min(filled, env.length);
  const reach = LOCAL_SECONDS * COLUMNS_PER_SECOND;
  const from = Math.max(0, Math.floor(centre * COLUMNS_PER_SECOND - reach));
  const to = Math.min(bound, Math.ceil(centre * COLUMNS_PER_SECOND + reach));
  if (to - from < columns * 4) return origin;
  const base = origin * COLUMNS_PER_SECOND;
  let bestShift = 0;
  let best = -1;
  for (let slot = 0; slot < ORIGIN_STEPS; slot += 1) {
    const shift = (slot / ORIGIN_STEPS - 0.5) * columns;
    const score = pulseMean(env, from, to, columns, base + shift, 0);
    if (score > best) {
      best = score;
      bestShift = shift;
    }
  }
  return origin + bestShift / COLUMNS_PER_SECOND;
}

export function beatPhase(seconds: number, period: number, origin: number): number {
  if (!(period > 0)) return 0;
  const raw = (seconds - origin) / period;
  return raw - Math.floor(raw);
}

export function phaseDelta(first: number, second: number): number {
  const diff = first - second;
  return diff - Math.round(diff);
}
