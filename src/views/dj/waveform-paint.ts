import { levelScale, type BandPeaks } from "@/lib/music/waveform-dsp";

const LOW_TINT = [1, 0.29, 0.24];
const MID_TINT = [0.21, 0.82, 0.42];
const HIGH_TINT = [0.23, 0.72, 1];
const SHAPE = 0.62;
const SATURATION = 1.6;
const LUMA = 248;
const FLOOR = 0.05;
const BEAT_LINE = "rgb(255 255 255 / 0.14)";
const BAR_LINE = "rgb(255 255 255 / 0.42)";
const PLAYHEAD = "rgb(255 176 46)";
const CURSOR = "rgb(255 255 255 / 0.92)";
const BEHIND = "rgb(4 5 7 / 0.58)";

export function paintPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: BandPeaks,
  filled: number,
  from: number,
  to: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (filled <= 0 || width <= 0 || height <= 0) return;
  const span = Math.max(1e-6, to - from);
  const scale = levelScale(peaks, filled);
  const centre = height / 2;
  const perPixel = Math.max(1, (span * peaks.perSecond) / width);
  for (let x = 0; x < width; x += 1) {
    const head = Math.floor((from + (x / width) * span) * peaks.perSecond);
    const tail = Math.max(head + 1, Math.round(head + perPixel));
    let low = 0;
    let mid = 0;
    let high = 0;
    let level = 0;
    for (let index = Math.max(0, head); index < tail && index < filled; index += 1) {
      if (peaks.low[index] > low) low = peaks.low[index];
      if (peaks.mid[index] > mid) mid = peaks.mid[index];
      if (peaks.high[index] > high) high = peaks.high[index];
      if (peaks.level[index] > level) level = peaks.level[index];
    }
    if (level <= 0) continue;
    const mix = low + mid + high || 1;
    const red = (low * LOW_TINT[0] + mid * MID_TINT[0] + high * HIGH_TINT[0]) / mix;
    const green = (low * LOW_TINT[1] + mid * MID_TINT[1] + high * HIGH_TINT[1]) / mix;
    const blue = (low * LOW_TINT[2] + mid * MID_TINT[2] + high * HIGH_TINT[2]) / mix;
    const mean = (red + green + blue) / 3;
    const channel = (value: number) =>
      Math.max(0, Math.min(255, Math.round((mean + (value - mean) * SATURATION) * LUMA)));
    const tint = `${channel(red)} ${channel(green)} ${channel(blue)}`;
    ctx.fillStyle = `rgb(${tint})`;
    const amp = Math.min(1, Math.pow(level / scale, SHAPE));
    const half = Math.max(1, (FLOOR + amp * (1 - FLOOR)) * (centre - 1));
    ctx.fillRect(x, centre - half, 1, half * 2);
  }
}

export function blit(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  offset: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  const left = Math.max(0, offset);
  const right = Math.min(source.width, offset + width);
  if (right <= left || source.height <= 0) return;
  const slice = right - left;
  ctx.drawImage(source, left, 0, slice, source.height, left - offset, 0, slice, height);
}

export function drawBeats(
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  width: number,
  height: number,
  period: number,
  origin: number,
  weight: number,
): void {
  if (!(period > 0.12) || to <= from) return;
  const span = to - from;
  const first = Math.ceil((from - origin) / period);
  const last = Math.floor((to - origin) / period);
  if (last - first > 512) return;
  for (let beat = first; beat <= last; beat += 1) {
    const bar = ((beat % 4) + 4) % 4 === 0;
    const x = Math.round(((origin + beat * period - from) / span) * width);
    ctx.fillStyle = bar ? BAR_LINE : BEAT_LINE;
    ctx.fillRect(x, bar ? 0 : height * 0.2, weight, bar ? height : height * 0.6);
  }
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  height: number,
  weight: number,
): void {
  ctx.fillStyle = PLAYHEAD;
  ctx.fillRect(Math.round(x - weight / 2), 0, weight, height);
}

export function drawCursor(
  ctx: CanvasRenderingContext2D,
  ratio: number,
  width: number,
  height: number,
  weight: number,
): void {
  const x = Math.max(0, Math.min(width, ratio * width));
  ctx.fillStyle = BEHIND;
  ctx.fillRect(0, 0, x, height);
  ctx.fillStyle = CURSOR;
  ctx.fillRect(Math.round(x - weight / 2), 0, weight, height);
}
