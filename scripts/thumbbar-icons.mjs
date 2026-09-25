#!/usr/bin/env node
// Regenerates the Windows thumbnail-toolbar glyphs in src-tauri/icons/thumbbar.
// They are hand-drawn because 16x16 is too small to downscale anything into: a
// scaled vector turns to mush at this size, so every pixel is placed here.
// Run: node scripts/thumbbar-icons.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons", "thumbbar");
const SIZE = 16;

const HEART = [
  "................",
  "................",
  "..###.....###...",
  ".#####...#####..",
  "###############.",
  "###############.",
  "###############.",
  ".#############..",
  "..###########...",
  "...#########....",
  "....#######.....",
  ".....#####......",
  "......###.......",
  ".......#........",
  "................",
  "................",
];

const BACK = [
  "................",
  "................",
  "................",
  ".......#...#....",
  "......##..##....",
  ".....###.###....",
  "....########....",
  "...#########....",
  "...#########....",
  "....########....",
  ".....###.###....",
  "......##..##....",
  ".......#...#....",
  "................",
  "................",
  "................",
];

const PREV = [
  "................",
  "................",
  "................",
  "..##.......#....",
  "..##......##....",
  "..##.....###....",
  "..##....####....",
  "..##...#####....",
  "..##...#####....",
  "..##....####....",
  "..##.....###....",
  "..##......##....",
  "..##.......#....",
  "................",
  "................",
  "................",
];

const PLAY = [
  "................",
  "................",
  "................",
  ".....#..........",
  ".....##.........",
  ".....###........",
  ".....####.......",
  ".....#####......",
  ".....#####......",
  ".....####.......",
  ".....###........",
  ".....##.........",
  ".....#..........",
  "................",
  "................",
  "................",
];

const PAUSE = [
  "................",
  "................",
  "................",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "...##.....##....",
  "................",
  "................",
  "................",
];

// Speaker on the left, a bold X clear of it on the right. An X drawn one pixel
// thick vanishes at this size, so both strokes are two pixels wide.
const MUTE = [
  "................",
  "................",
  "................",
  "......#.........",
  ".....##.##...##.",
  "....###..##.##..",
  ".######...###...",
  ".######....#....",
  ".######...###...",
  ".######..##.##..",
  "....###.##...##.",
  ".....##.........",
  "......#.........",
  "................",
  "................",
  "................",
];

/** Next is previous facing the other way, and fast-forward is rewind facing the other way. */
function mirror(rows) {
  return rows.map((row) => [...row].reverse().join(""));
}

function ico(rows) {
  const and = Math.ceil(SIZE / 32) * 4 * SIZE;
  const xor = SIZE * SIZE * 4;
  const dib = Buffer.alloc(40 + xor + and);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(SIZE, 4);
  dib.writeInt32LE(SIZE * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const on = rows[y][x] === "#";
      const at = 40 + ((SIZE - 1 - y) * SIZE + x) * 4;
      dib[at] = 255;
      dib[at + 1] = 255;
      dib[at + 2] = 255;
      dib[at + 3] = on ? 255 : 0;
    }
  }
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head[6] = SIZE;
  head[7] = SIZE;
  head[8] = 0;
  head[9] = 0;
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(dib.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, dib]);
}

const glyphs = {
  fav: HEART,
  back: BACK,
  prev: PREV,
  play: PLAY,
  pause: PAUSE,
  next: mirror(PREV),
  fwd: mirror(BACK),
  mute: MUTE,
};

mkdirSync(OUT, { recursive: true });
for (const [name, rows] of Object.entries(glyphs)) {
  if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE)) {
    throw new Error(`${name} is not ${SIZE}x${SIZE}`);
  }
  writeFileSync(join(OUT, `${name}.ico`), ico(rows));
  console.log(`${name}.ico`);
}
