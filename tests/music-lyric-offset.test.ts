import test from "node:test";
import assert from "node:assert/strict";
import {
  clampLyricOffset,
  parseOffsets,
  shiftedLyricTime,
  trimOffsets,
  LYRIC_OFFSET_LIMIT,
} from "../src/lib/music/lyric-offset";

test("lyrics running ahead are pushed later, and behind are pulled earlier", () => {
  assert.equal(shiftedLyricTime(60, 0.5), 59.5);
  assert.equal(shiftedLyricTime(60, -0.5), 60.5);
  assert.equal(shiftedLyricTime(60, 0), 60);
});

test("a shift never seeks the lyric lookup before the start of the song", () => {
  assert.equal(shiftedLyricTime(0.2, 2), 0);
});

test("a nonsense time or offset is survivable", () => {
  assert.equal(shiftedLyricTime(Number.NaN, 1), 0);
  assert.equal(shiftedLyricTime(10, Number.NaN), 10);
});

test("offsets are clamped and snapped to the step", () => {
  assert.equal(clampLyricOffset(999), LYRIC_OFFSET_LIMIT);
  assert.equal(clampLyricOffset(-999), -LYRIC_OFFSET_LIMIT);
  assert.equal(clampLyricOffset(0.3), 0.25);
  assert.equal(clampLyricOffset(Number.NaN), 0);
});

test("stored offsets survive a round trip and reject junk", () => {
  assert.deepEqual(parseOffsets(JSON.stringify({ "a:1": 0.5 })), { "a:1": 0.5 });
  assert.deepEqual(parseOffsets("not json"), {});
  assert.deepEqual(parseOffsets(JSON.stringify(["nope"])), {});
  assert.deepEqual(parseOffsets(JSON.stringify({ "a:1": "x", "b:2": 0.25 })), { "b:2": 0.25 });
});

test("the map is bounded so it cannot grow without limit in storage", () => {
  const many: Record<string, number> = {};
  for (let i = 0; i < 250; i += 1) many[`k${i}`] = 0.25;
  const trimmed = trimOffsets(many, 200);
  assert.equal(Object.keys(trimmed).length, 200);
  assert.ok(!("k0" in trimmed), "the oldest entries are dropped first");
  assert.ok("k249" in trimmed, "the newest are kept");
});
