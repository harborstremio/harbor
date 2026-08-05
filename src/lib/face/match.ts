export type FaceBox = { x: number; y: number; w: number; h: number };

export type WireFace = { box: FaceBox; embedding: number[] };

export type GalleryEntry = {
  id: number;
  name: string;
  character: string;
  profilePath: string;
  emb: Float32Array;
};

export type Match = { id: number; name: string; character: string; score: number; margin: number };

export const TAU_ABS = 0.38;
export const TAU_MARGIN = 0.06;
export const MIN_BOX_PX = 56;

export function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const inv = 1 / Math.sqrt(s + 1e-12);
  const o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = v[i] * inv;
  return o;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function classify(
  probe: Float32Array,
  gallery: GalleryEntry[],
  tauAbs = TAU_ABS,
  tauMargin = TAU_MARGIN,
): Match | null {
  if (gallery.length === 0) return null;
  let best = -Infinity;
  let second = -Infinity;
  let hit: GalleryEntry | null = null;
  for (const g of gallery) {
    const s = dot(probe, g.emb);
    if (s > best) {
      second = best;
      best = s;
      hit = g;
    } else if (s > second) {
      second = s;
    }
  }
  const margin = best - second;
  if (!hit || best < tauAbs || margin < tauMargin) return null;
  return { id: hit.id, name: hit.name, character: hit.character, score: best, margin };
}
