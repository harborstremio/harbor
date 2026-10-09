import assert from "node:assert/strict";
import test from "node:test";
import { musicDockSpectrum } from "../src/lib/music/dock-visualizer";

test("bass and treble follow their own measured energy", () => {
  const bass = musicDockSpectrum([-10, -30, -60, -60, -60, -60, -60, -60], true);
  assert.equal(bass[0], 1);
  assert.ok(bass[1] > 0 && bass[1] < 1);
  assert.equal(bass[7], 0);
  const treble = musicDockSpectrum([-60, -60, -60, -60, -60, -60, -30, -10], true);
  assert.equal(treble[0], 0);
  assert.equal(treble[7], 1);
});

test("silence, absent bands and paused audio rest without synthesizing movement", () => {
  for (const bands of [undefined, [], [-10], Array(8).fill(-120)]) {
    assert.deepEqual(musicDockSpectrum(bands, true), Array(8).fill(0));
  }
  assert.deepEqual(musicDockSpectrum(Array(8).fill(-10), false), Array(8).fill(0));
});

test("new measurements replace levels immediately and remain finite", () => {
  assert.deepEqual(musicDockSpectrum(Array(8).fill(-10), true), Array(8).fill(1));
  assert.deepEqual(musicDockSpectrum(Array(8).fill(-60), true), Array(8).fill(0));
  assert.deepEqual(musicDockSpectrum([NaN, Infinity, -Infinity, 24, -120, -60, -10, -35], true), [
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    0.5 ** 1.5,
  ]);
});
