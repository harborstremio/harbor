import assert from "node:assert/strict";
import test from "node:test";
import { decodeMusicGif, musicGifFrameAt } from "../src/lib/music/gif-frames";
import { createGifClock } from "../src/lib/music/gif-clock";

// Tiny independently encoded GIFs exercise subrectangles and disposal modes,
// rather than relying on our decoder to create its own test inputs.
function gif(frames: { x: number; pixels: number[]; dispose?: number; transparent?: boolean; delay?: number }[]) {
  const data = [...Buffer.from("GIF89a"), 3, 0, 1, 0, 0x81, 3, 0,
    0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255];
  for (const frame of frames) {
    data.push(0x21, 0xf9, 4, ((frame.dispose ?? 1) << 2) | Number(!!frame.transparent), frame.delay ?? 10, 0, 0, 0,
      0x2c, frame.x, 0, 0, 0, frame.pixels.length, 0, 1, 0, 0, 2);
    const codes = frame.pixels.flatMap(pixel => [4, pixel]).concat(5);
    const packed: number[] = [];
    let bits = 0, count = 0;
    for (const code of codes) {
      bits |= code << count; count += 3;
      while (count >= 8) { packed.push(bits & 255); bits >>= 8; count -= 8; }
    }
    if (count) packed.push(bits);
    data.push(packed.length, ...packed, 0);
  }
  data.push(0x3b);
  return Uint8Array.from(data).buffer;
}
const R = [255, 0, 0, 255], G = [0, 255, 0, 255], B = [0, 0, 255, 255], T = [0, 0, 0, 0];
const pixels = (frame: Uint8ClampedArray) => Array.from(frame);

test("opaque disposal 2 restores the logical background only within the previous rectangle", () => {
  const result = decodeMusicGif(gif([
    { x: 1, pixels: [1], dispose: 2 }, { x: 2, pixels: [2] },
  ]));
  assert.deepEqual(pixels(result.frames[0]), [...B, ...R, ...B]);
  assert.deepEqual(pixels(result.frames[1]), [...B, ...B, ...G]);
});

test("transparent stickers clear disposed patches without an opaque bounding box", () => {
  const result = decodeMusicGif(gif([
    { x: 0, pixels: [1, 0, 0], transparent: true, dispose: 2 },
    { x: 1, pixels: [2], transparent: true },
  ]));
  assert.deepEqual(pixels(result.frames[0]), [...R, ...T, ...T]);
  assert.deepEqual(pixels(result.frames[1]), [...T, ...G, ...T]);
});

test("disposal 3 restores the pre-frame image and transparent pixels preserve underlying paint", () => {
  const result = decodeMusicGif(gif([
    { x: 0, pixels: [1, 1, 1] },
    { x: 0, pixels: [0, 2], transparent: true, dispose: 3 },
    { x: 2, pixels: [2] },
  ]));
  assert.deepEqual(pixels(result.frames[1]), [...R, ...G, ...R]);
  assert.deepEqual(pixels(result.frames[2]), [...R, ...R, ...G]);
});

test("authored uneven delays and loop wrap determine the displayed pose", () => {
  const animation = decodeMusicGif(gif([
    { x: 0, pixels: [1], delay: 10 }, { x: 0, pixels: [2], delay: 30 },
  ]));
  assert.deepEqual(animation.delays, [100, 300]);
  assert.equal(animation.duration, 400);
  assert.deepEqual([0, .249, .25, .999, 1, 1.5, -.1].map(t => musicGifFrameAt(animation, t)), [0, 0, 1, 1, 0, 1, 1]);
});

test("invalid signatures and overflowing frame rectangles fail before composition", () => {
  assert.throws(() => decodeMusicGif(new Uint8Array([1, 2, 3]).buffer), /invalid/);
  assert.throws(() => decodeMusicGif(gif([{ x: 2, pixels: [1, 2] }])), /invalid/);
});

function run(clock: ReturnType<typeof createGifClock>, ms: number, period: number, timing: "auto" | "1" | "2" | "4" | "8" = "auto", start = 0) {
  let previous = clock.advance(0, true, undefined, timing), loops = 0, maxStep = 0;
  for (let time = 16; time <= ms; time += 16) {
    const position = clock.advance(16, true, { locked: true, period, beat: (time + start) / period }, timing);
    const step = (position - previous + 1) % 1;
    maxStep = Math.max(maxStep, step);
    loops += position < previous ? 1 : 0; previous = position;
  }
  return { loops, maxStep, position: previous };
}

test("a two-beat loop follows slow and fast songs without jumping backward or skipping a pose", () => {
  for (const period of [280, 500, 820]) {
    const clock = createGifClock(1000);
    run(clock, 4000, period, "2");
    const result = run(clock, 8000, period, "2", 4000);
    assert.ok(Math.abs(result.loops - 8000 / (period * 2)) < 1.2);
    assert.ok(result.maxStep < .05);
  }
});

test("pause freezes the exact frame and a track change relearns automatic timing without a reset", () => {
  const clock = createGifClock(1900);
  const before = run(clock, 3333, 500).position;
  assert.equal(clock.advance(6000, false), before);
  clock.retime();
  assert.equal(clock.advance(0, true), before);
  run(clock, 4000, 280);
  const fast = run(clock, 8960, 280, "auto", 4000);
  assert.ok(Math.abs(fast.loops - 4) <= 1, "new song selects an eight-beat loop near the original duration");
  assert.ok(fast.maxStep < .03);
});

test("before a beat is known the GIF retains its authored speed; gaps keep the acquired tempo", () => {
  const clock = createGifClock(1000);
  let position = 0;
  for (let i = 0; i < 25; i++) position = clock.advance(16, true);
  assert.ok(Math.abs(position - .4) < .001);
  run(clock, 4000, 400, "1");
  const before = clock.advance(0, true, undefined, "1");
  for (let i = 0; i < 10; i++) position = clock.advance(16, true, { locked: false, period: null, beat: 0 }, "1");
  assert.ok(Math.abs((position - before + 1) % 1 - .4) < .01);
});

test("every shipped language exposes all GIF controls and errors through its composed catalog", async () => {
  const english = (await import("../src/lib/i18n/locales/en/music-gif")).default;
  for (const language of ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"]) {
    const catalog = (await import(`../src/lib/i18n/locales/${language}/music.ts`)).default;
    for (const key of Object.keys(english)) assert.ok(catalog[key] && catalog[key] !== key, `${language}: ${key}`);
    if (language !== "en") assert.notEqual(catalog["music.gif.body"], english["music.gif.body"]);
  }
});
