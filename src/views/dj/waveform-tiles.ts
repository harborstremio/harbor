import { levelScale, type BandPeaks, type BeatGrid } from "@/lib/music/waveform-dsp";
import { blit, drawBeats, drawCursor, paintPeaks } from "./waveform-paint";

const TILE_SPAN = 1.6;
const SLIDE_STEP = 0.25;

type Ink = {
  peaks: BandPeaks;
  filled: number;
  stamp: number;
  grid: BeatGrid | null;
};

type Tile = {
  face: HTMLCanvasElement | null;
  spare: HTMLCanvasElement | null;
  from: number;
  perSecond: number;
  width: number;
  height: number;
  stamp: number;
  filled: number;
  scale: number;
  origin: number;
  beat: number;
  phase: number;
  seen: BandPeaks | null;
  level: number;
  levelAt: number;
};

type Sheet = {
  canvas: HTMLCanvasElement | null;
  stamp: number;
  width: number;
  height: number;
};

export function createTile(): Tile {
  return {
    face: null,
    spare: null,
    from: 0,
    perSecond: 0,
    width: 0,
    height: 0,
    stamp: -1,
    filled: -1,
    scale: 0,
    origin: 0,
    beat: -1,
    phase: -1,
    seen: null,
    level: 1,
    levelAt: -1,
  };
}

export function createSheet(): Sheet {
  return { canvas: null, stamp: -1, width: 0, height: 0 };
}

function gauge(tile: Tile, ink: Ink): number {
  if (tile.seen === ink.peaks && tile.levelAt === ink.filled) return tile.level;
  tile.seen = ink.peaks;
  tile.levelAt = ink.filled;
  tile.level = levelScale(ink.peaks, ink.filled);
  return tile.level;
}

function beatOf(ink: Ink): number {
  return ink.grid ? ink.grid.period : 0;
}

function phaseOf(ink: Ink): number {
  return ink.grid ? ink.grid.origin : 0;
}

function tileCentre(tile: Tile): number {
  return tile.from + tile.width / (2 * tile.perSecond);
}

function covered(tile: Tile, ink: Ink): boolean {
  const to = tile.from + tile.width / tile.perSecond;
  return tile.filled >= Math.min(ink.peaks.columns, Math.ceil(to * ink.peaks.perSecond));
}

function paintRange(
  tile: Tile,
  ink: Ink,
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  weight: number,
): void {
  const from = tile.from + x / tile.perSecond;
  const to = from + width / tile.perSecond;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, width, tile.height);
  ctx.clip();
  ctx.translate(x, 0);
  paintPeaks(ctx, ink.peaks, ink.filled, from, to, width, tile.height);
  if (ink.grid) {
    drawBeats(ctx, from, to, width, tile.height, ink.grid.period, tile.origin, weight);
  }
  ctx.restore();
}

function rebuild(
  tile: Tile,
  ink: Ink,
  centre: number,
  perSecond: number,
  width: number,
  height: number,
  weight: number,
  origin: number,
  scale: number,
): void {
  const wide = Math.max(1, Math.round(width * TILE_SPAN));
  const face = tile.face ?? document.createElement("canvas");
  const spare = tile.spare ?? document.createElement("canvas");
  for (const canvas of [face, spare]) {
    if (canvas.width !== wide) canvas.width = wide;
    if (canvas.height !== height) canvas.height = height;
  }
  tile.face = face;
  tile.spare = spare;
  tile.perSecond = perSecond;
  tile.width = wide;
  tile.height = height;
  tile.from = centre - wide / (2 * perSecond);
  tile.origin = origin;
  tile.stamp = ink.stamp;
  tile.filled = ink.filled;
  tile.scale = scale;
  tile.beat = beatOf(ink);
  tile.phase = phaseOf(ink);
  const ctx = face.getContext("2d");
  if (!ctx) return;
  paintRange(tile, ink, ctx, 0, wide, weight);
}

function slide(tile: Tile, ink: Ink, centre: number, weight: number): boolean {
  const face = tile.face;
  const spare = tile.spare;
  if (!face || !spare) return false;
  const want = centre - tile.width / (2 * tile.perSecond);
  const shift = Math.round((want - tile.from) * tile.perSecond);
  if (shift === 0) return true;
  if (Math.abs(shift) >= tile.width) return false;
  const ctx = spare.getContext("2d");
  if (!ctx) return false;
  ctx.clearRect(0, 0, tile.width, tile.height);
  ctx.drawImage(face, -shift, 0);
  tile.from += shift / tile.perSecond;
  tile.face = spare;
  tile.spare = face;
  paintRange(tile, ink, ctx, shift > 0 ? tile.width - shift : 0, Math.abs(shift), weight);
  return true;
}

export function syncTile(
  tile: Tile,
  ink: Ink,
  centre: number,
  span: number,
  width: number,
  height: number,
  weight: number,
  findOrigin: (at: number) => number,
): void {
  const perSecond = width / Math.max(1e-6, span);
  const scale = gauge(tile, ink);
  const sized =
    Boolean(tile.face) &&
    tile.perSecond === perSecond &&
    tile.width === Math.max(1, Math.round(width * TILE_SPAN)) &&
    tile.height === height;
  const scored = tile.beat === beatOf(ink) && tile.phase === phaseOf(ink);
  const fed = tile.stamp === ink.stamp || (tile.scale === scale && covered(tile, ink));
  if (!sized || !scored || !fed) {
    rebuild(tile, ink, centre, perSecond, width, height, weight, findOrigin(centre), scale);
    return;
  }
  tile.stamp = ink.stamp;
  if (Math.abs(centre - tileCentre(tile)) <= span * SLIDE_STEP) return;
  if (!slide(tile, ink, centre, weight)) {
    rebuild(tile, ink, centre, perSecond, width, height, weight, findOrigin(centre), scale);
  }
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  centre: number,
  width: number,
  height: number,
): void {
  if (!tile.face) return;
  blit(ctx, tile.face, (centre - tile.from) * tile.perSecond - width / 2, width, height);
}

export function paintSheet(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  ink: Ink,
  at: number,
  length: number,
  width: number,
  height: number,
  weight: number,
): void {
  if (sheet.stamp !== ink.stamp || sheet.width !== width || sheet.height !== height) {
    const plate = sheet.canvas ?? document.createElement("canvas");
    plate.width = Math.max(1, width);
    plate.height = Math.max(1, height);
    const plateCtx = plate.getContext("2d");
    if (plateCtx) {
      paintPeaks(plateCtx, ink.peaks, ink.filled, 0, length, plate.width, plate.height);
    }
    sheet.canvas = plate;
    sheet.stamp = ink.stamp;
    sheet.width = plate.width;
    sheet.height = plate.height;
  }
  if (!sheet.canvas) return;
  blit(ctx, sheet.canvas, 0, width, height);
  drawCursor(ctx, at / length, width, height, weight);
}
