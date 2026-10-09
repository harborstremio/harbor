// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { deltaFn } from "../src/lib/subtitles/text-sync.ts";

test("nearby manual alignments do not extrapolate reaction-time error into runaway drift", () => {
  const offset = deltaFn(
    [
      { t: 10, at: 12 },
      { t: 11, at: 14 },
    ],
    0,
  );
  assert.equal(offset(11), 3);
  assert.equal(offset(131), 3);
});

test("implausible drift falls back to the most recent alignment", () => {
  const offset = deltaFn(
    [
      { t: 10, at: 12 },
      { t: 110, at: 132 },
    ],
    0.1,
  );
  assert.equal(offset(230), 22.1);
});

test("valid gradual drift remains supported", () => {
  const offset = deltaFn(
    [
      { t: 10, at: 12 },
      { t: 110, at: 116 },
    ],
    0,
  );
  assert.equal(offset(110), 6);
});
