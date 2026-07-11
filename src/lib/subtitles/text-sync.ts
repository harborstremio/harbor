import type { SubCue } from "./parser";

export type SyncAnchor = {
  t: number;
  heardAt: number;
  delta: number;
  cueIndex: number;
};

export const MIN_GAP_SEC = 3.0;
export const MAX_SLOPE = 0.05;

export function computeSyncMap(anchors: SyncAnchor[]): (t: number) => number {
  if (anchors.length === 0) {
    return () => 0;
  }
  if (anchors.length === 1) {
    const d = anchors[0].delta;
    return () => d;
  }
  const sorted = [...anchors].sort((a, b) => a.t - b.t);
  const a1 = sorted[0];
  const a2 = sorted[sorted.length - 1];
  const dt = a2.t - a1.t;
  if (Math.abs(dt) < 1e-9) {
    throw new Error(
      "computeSyncMap: anchor points share the same original time (t1 === t2); cannot compute linear slope",
    );
  }
  const m = (a2.delta - a1.delta) / dt;
  const d1 = a1.delta;
  const t1 = a1.t;
  return (t: number) => d1 + m * (t - t1);
}

export function applySync(cues: SubCue[], f: (t: number) => number, extraOffsetSec: number): SubCue[] {
  return cues.map((cue) => {
    const start = round3(Math.max(0, cue.start + f(cue.start) + extraOffsetSec));
    const endCandidate = round3(cue.end + f(cue.end) + extraOffsetSec);
    const end = Math.max(start + 0.001, endCandidate);
    return { start, end, text: cue.text };
  });
}

export type SyncPoint = { t: number; at: number };

export function deltaFn(points: SyncPoint[], nudge: number): (t: number) => number {
  if (points.length === 0) return () => nudge;
  if (points.length === 1) {
    const d = points[0].at - points[0].t;
    return () => d + nudge;
  }
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const a = sorted[0];
  const b = sorted[sorted.length - 1];
  const d1 = a.at - a.t;
  const span = b.t - a.t;
  if (Math.abs(span) < 1e-6) return () => d1 + nudge;
  const m = (b.at - b.t - d1) / span;
  return (t: number) => d1 + m * (t - a.t) + nudge;
}

export type SyncSegment = { startIdx: number; endIdx: number; offsetSec: number };

export function applyLinear(cues: SubCue[], points: SyncPoint[], nudge: number, segments: SyncSegment[]): SubCue[] {
  const f = deltaFn(points, nudge);
  return cues.map((cue, i) => {
    let segExtra = 0;
    for (const seg of segments) if (i >= seg.startIdx && i <= seg.endIdx) segExtra += seg.offsetSec;
    const start = round3(Math.max(0, cue.start + f(cue.start) + segExtra));
    const end = Math.max(start + 0.001, round3(cue.end + f(cue.end) + segExtra));
    return { start, end, text: cue.text };
  });
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function evaluateAnchors(anchors: SyncAnchor[]): {
  gapSec: number | null;
  slopePct: number | null;
} {
  if (anchors.length < 2) {
    return { gapSec: null, slopePct: null };
  }
  const sorted = [...anchors].sort((a, b) => a.t - b.t);
  const a1 = sorted[0];
  const a2 = sorted[sorted.length - 1];
  const gap = Math.abs(a2.t - a1.t);
  const gapSec = gap < MIN_GAP_SEC ? gap : null;
  let slopePct: number | null = null;
  if (gap > 1e-9) {
    const m = Math.abs((a2.delta - a1.delta) / (a2.t - a1.t));
    if (m > MAX_SLOPE) slopePct = m * 100;
  }
  return { gapSec, slopePct };
}
