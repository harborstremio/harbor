export const ARCFACE_112_4PT: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [56.1396, 92.2848],
];

export type Mat2x3 = [number, number, number, number, number, number];

export function umeyamaSimilarity(src: [number, number][], dst: [number, number][]): Mat2x3 {
  const n = src.length;
  let msx = 0;
  let msy = 0;
  let mdx = 0;
  let mdy = 0;
  for (let i = 0; i < n; i++) {
    msx += src[i][0];
    msy += src[i][1];
    mdx += dst[i][0];
    mdy += dst[i][1];
  }
  msx /= n;
  msy /= n;
  mdx /= n;
  mdy /= n;
  let varSrc = 0;
  let s11 = 0;
  let s12 = 0;
  let s21 = 0;
  let s22 = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - msx;
    const sy = src[i][1] - msy;
    const dx = dst[i][0] - mdx;
    const dy = dst[i][1] - mdy;
    varSrc += sx * sx + sy * sy;
    s11 += dx * sx;
    s12 += dx * sy;
    s21 += dy * sx;
    s22 += dy * sy;
  }
  varSrc /= n;
  s11 /= n;
  s12 /= n;
  s21 /= n;
  s22 /= n;
  const a = s11 + s22;
  const b = s21 - s12;
  const theta = Math.atan2(b, a);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const scale = Math.sqrt(a * a + b * b) / varSrc;
  const A = scale * cos;
  const B = -scale * sin;
  const D = scale * sin;
  const E = scale * cos;
  const C = mdx - (A * msx + B * msy);
  const F = mdy - (D * msx + E * msy);
  return [A, B, C, D, E, F];
}

export function mpKeypointsTo4pt(kps: { x: number; y: number }[], w: number, h: number): [number, number][] {
  const p = (k: { x: number; y: number }): [number, number] => [k.x * w, k.y * h];
  const e0 = p(kps[0]);
  const e1 = p(kps[1]);
  const eyes: [[number, number], [number, number]] = e0[0] <= e1[0] ? [e0, e1] : [e1, e0];
  return [eyes[0], eyes[1], p(kps[2]), p(kps[3])];
}

export function align112(image: ImageBitmap, detected: [number, number][]): OffscreenCanvas {
  const m = umeyamaSimilarity(detected, ARCFACE_112_4PT);
  const out = new OffscreenCanvas(112, 112);
  const ctx = out.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(m[0], m[3], m[1], m[4], m[2], m[5]);
  ctx.drawImage(image, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return out;
}

const MEAN = 0;
const STD = 1;

export function faceToTensor(canvas: OffscreenCanvas): Float32Array {
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  const { data } = ctx.getImageData(0, 0, 112, 112);
  const out = new Float32Array(3 * 112 * 112);
  const plane = 112 * 112;
  for (let i = 0; i < plane; i++) {
    out[i] = (data[i * 4] - MEAN) / STD;
    out[plane + i] = (data[i * 4 + 1] - MEAN) / STD;
    out[2 * plane + i] = (data[i * 4 + 2] - MEAN) / STD;
  }
  return out;
}
