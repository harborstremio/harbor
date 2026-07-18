import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "..", "src", "assets");

const MARK_PATHS = [
  "m 72.0781,1534.27 c 0,0 1127.5819,922.03 1526.9319,2636.89 0,0 463.95,-1274.4 17.61,-2625.15 L 72.0781,1534.27",
  "M 3975.59,2945.05 2812.18,2222.26 c -36.68,-22.79 -84.13,3.59 -84.13,46.78 v 1391.45 c 0,42.35 45.8,68.85 82.51,47.75 l 1163.41,-668.68 c 36.11,-20.75 37,-72.53 1.62,-94.51 z M 2021.85,4821.57 V 1438.84 l 2818.94,416.96 c 0,0 252.54,2501.82 -2818.94,2965.77",
  "m 615.313,4.40234 c 0,0 -364.817,308.39866 -604.4224,706.25766 -28.3125,47.012 1.4922,107.77 55.8555,115.281 L 5090.13,1520.12 c 57.31,7.92 102.66,-47.69 82.95,-102.09 C 5065.81,1122 4746.77,351.742 4222.68,0 L 615.313,4.40234",
];

function markSvg(fill) {
  const paths = MARK_PATHS.map((d) => `<path d="${d}" />`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 642.88"><g transform="matrix(0.13333333,0,0,-0.13333333,0,642.88)" fill="${fill}">${paths}</g></svg>`;
}

function wordmarkSvg(fill) {
  return readFileSync(join(assets, "harbor-wordmark.svg"), "utf8").replace(
    /class="cls-1"/g,
    `fill="${fill}"`,
  );
}

function rasterByWidth(svg, width) {
  return new Resvg(svg, { fitTo: { mode: "width", value: Math.round(width) } }).render().asPng();
}

function rasterByHeight(svg, height) {
  return new Resvg(svg, { fitTo: { mode: "height", value: Math.round(height) } }).render().asPng();
}

function rasterIntrinsic(svg) {
  return new Resvg(svg, {}).render().asPng();
}

function writeBmp24(path, width, height, rgb) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixels = rowSize * height;
  const buf = Buffer.alloc(54 + pixels);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + pixels, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixels, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    let off = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const si = (srcY * width + x) * 3;
      buf[off++] = rgb[si + 2];
      buf[off++] = rgb[si + 1];
      buf[off++] = rgb[si];
    }
  }
  writeFileSync(path, buf);
}

async function finishBmp(composedPng, w, h, bg, bmpPath, previewPath) {
  const png = await sharp(composedPng).resize(w, h).flatten({ background: bg }).png().toBuffer();
  writeFileSync(previewPath, png);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  writeBmp24(bmpPath, info.width, info.height, data);
}

async function sidebar() {
  const W = 164,
    H = 314,
    s = 2;
  const base = rasterIntrinsic(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * s}" height="${H * s}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1f26"/><stop offset="0.55" stop-color="#15171c"/><stop offset="1" stop-color="#0d0f13"/></linearGradient></defs><rect width="${W * s}" height="${H * s}" fill="url(#g)"/></svg>`,
  );
  const mark = rasterByWidth(markSvg("#f4f4f5"), 86 * s);
  const word = rasterByWidth(wordmarkSvg("#eef0f2"), 122 * s);
  const mm = await sharp(mark).metadata();
  const wm = await sharp(word).metadata();
  const gap = 28 * s;
  const startY = Math.round((H * s - (mm.height + gap + wm.height)) / 2);
  const composed = await sharp(base)
    .composite([
      { input: mark, left: Math.round((W * s - mm.width) / 2), top: startY },
      { input: word, left: Math.round((W * s - wm.width) / 2), top: startY + mm.height + gap },
    ])
    .png()
    .toBuffer();
  await finishBmp(
    composed,
    W,
    H,
    "#0d0f13",
    join(here, "sidebar.bmp"),
    join(here, "sidebar-preview.png"),
  );
}

async function header() {
  const W = 150,
    H = 57,
    s = 2;
  const base = rasterIntrinsic(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * s}" height="${H * s}"><rect width="${W * s}" height="${H * s}" fill="#ffffff"/></svg>`,
  );
  const mark = rasterByHeight(markSvg("#11141a"), 36 * s);
  const mm = await sharp(mark).metadata();
  const composed = await sharp(base)
    .composite([{ input: mark, left: 16 * s, top: Math.round((H * s - mm.height) / 2) }])
    .png()
    .toBuffer();
  await finishBmp(
    composed,
    W,
    H,
    "#ffffff",
    join(here, "header.bmp"),
    join(here, "header-preview.png"),
  );
}

await sidebar();
await header();
console.log("done");
