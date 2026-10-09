import { invoke } from "@tauri-apps/api/core";
import {
  COLUMNS_PER_SECOND,
  createPeaks,
  detectGrid,
  fillPeaks,
  onsetEnvelope,
  type BandPeaks,
  type BeatGrid,
} from "./waveform-dsp";

const ANALYSIS_RATE = 11025;

const CHUNK_SECONDS = 36;
const CACHE_LIMIT = 4;
const GAP_MS = 110;
const EARLY_SECONDS = 30;
const GRID_SCOPE_SECONDS = 240;

export type TrackWaveform = {
  key: string;
  duration: number;
  peaks: BandPeaks;
  onset: Float32Array;
  filled: number;
  ready: number;
  grid: BeatGrid | null;
  failed: boolean;
  stamp: number;
};

type Listener = (view: TrackWaveform) => void;
type Job = { view: TrackWaveform; listeners: Set<Listener>; cancelled: boolean; done: boolean };

const cache = new Map<string, TrackWaveform>();
const jobs = new Map<string, Job>();
let stamps = 0;

function blank(key: string, duration: number): TrackWaveform {
  stamps += 1;
  return {
    key,
    duration,
    peaks: createPeaks(duration),
    onset: new Float32Array(0),
    filled: 0,
    ready: 0,
    grid: null,
    failed: false,
    stamp: stamps,
  };
}

function publish(job: Job): void {
  stamps += 1;
  job.view = { ...job.view, stamp: stamps };
  for (const listener of job.listeners) listener(job.view);
}

function remember(view: TrackWaveform): void {
  cache.delete(view.key);
  cache.set(view.key, view);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

async function readWindow(start: number, seconds: number): Promise<Float32Array | null> {
  try {
    const bytes = await invoke<ArrayBuffer>("music_scratch_window", {
      start,
      seconds,
      rate: ANALYSIS_RATE,
    });
    const frames = new Float32Array(bytes);
    return frames.length >= 2 ? frames : null;
  } catch {
    return null;
  }
}

function settle(job: Job): void {
  const view = job.view;
  const scope = Math.min(view.filled, GRID_SCOPE_SECONDS * COLUMNS_PER_SECOND);
  view.grid = detectGrid(view.onset, scope);
}

async function run(job: Job): Promise<void> {
  const key = job.view.key;
  const length = job.view.duration;
  const total = Math.max(1, Math.ceil(length / CHUNK_SECONDS));
  let early = false;
  let misses = 0;
  for (let index = 0; index < total; index += 1) {
    if (job.cancelled) return;
    const start = index * CHUNK_SECONDS;
    const seconds = Math.min(CHUNK_SECONDS, length - start);
    if (seconds <= 0.2) break;
    const frames = await readWindow(start, seconds);
    if (job.cancelled) return;
    if (!frames) {
      if (index === 0) {
        job.view.failed = true;
        job.done = true;
        publish(job);
        jobs.delete(key);
        return;
      }
      misses += 1;
      if (misses >= 2) break;
      continue;
    }
    misses = 0;
    const head = Math.round(start * COLUMNS_PER_SECOND);
    const view = job.view;
    const written = fillPeaks(view.peaks, frames, ANALYSIS_RATE, head);
    view.filled = Math.min(view.peaks.columns, head + written);
    view.ready = Math.min(1, view.filled / view.peaks.columns);
    view.onset = onsetEnvelope(view.peaks, view.filled);
    if (!early && view.filled >= EARLY_SECONDS * COLUMNS_PER_SECOND) {
      early = true;
      settle(job);
    }
    publish(job);
    if (index + 1 < total) await new Promise((done) => window.setTimeout(done, GAP_MS));
  }
  if (job.cancelled) return;
  settle(job);
  job.view.ready = 1;
  job.done = true;
  publish(job);
  jobs.delete(key);
  remember(job.view);
}

export function subscribeWaveform(key: string, duration: number, apply: Listener): () => void {
  if (!key || !(duration > 1)) return () => {};
  const held = cache.get(key);
  if (held && Math.abs(held.duration - duration) < 1.5) {
    apply(held);
    return () => {};
  }
  let job = jobs.get(key);
  if (!job) {
    for (const [other, running] of jobs) {
      running.cancelled = true;
      jobs.delete(other);
    }
    job = { view: blank(key, duration), listeners: new Set(), cancelled: false, done: false };
    jobs.set(key, job);
    void run(job);
  }
  const live = job;
  live.listeners.add(apply);
  apply(live.view);
  return () => {
    live.listeners.delete(apply);
    if (live.listeners.size > 0 || live.done) return;
    live.cancelled = true;
    if (jobs.get(key) === live) jobs.delete(key);
  };
}
