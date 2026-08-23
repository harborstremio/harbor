// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  formatSubBorderSize,
  normalizeSubBorderSize,
  stepSubBorderSize,
} from "../src/lib/settings/border-size.ts";
import { buildSubtitleOutline } from "../src/lib/player/subtitle-outline.ts";

test("normalize keeps decimal half steps", () => {
  assert.equal(normalizeSubBorderSize(3.5), 3.5);
  assert.equal(normalizeSubBorderSize(2), 2);
  assert.equal(normalizeSubBorderSize(1.5), 1.5);
});

test("normalize clamps to [1, 6]", () => {
  assert.equal(normalizeSubBorderSize(0), 1);
  assert.equal(normalizeSubBorderSize(-4), 1);
  assert.equal(normalizeSubBorderSize(6), 6);
  assert.equal(normalizeSubBorderSize(9), 6);
});

test("normalize snaps to the 0.5 step and guards float drift", () => {
  assert.equal(normalizeSubBorderSize(3.25), 3.5);
  assert.equal(normalizeSubBorderSize(3.3), 3.5);
  assert.equal(normalizeSubBorderSize(3.1500000000000004), 3); // float noise, nearest step is 3
  assert.equal(normalizeSubBorderSize(Number.NaN), 1);
  assert.equal(normalizeSubBorderSize(Number.POSITIVE_INFINITY), 1);
});

test("stepper moves by 0.5 without drift and respects bounds", () => {
  assert.equal(stepSubBorderSize(3.5, 1), 4);
  assert.equal(stepSubBorderSize(3.5, -1), 3);
  assert.equal(stepSubBorderSize(0, 1), 1);
  assert.equal(stepSubBorderSize(0, -1), 1);
  assert.equal(stepSubBorderSize(6, 1), 6);
  assert.equal(stepSubBorderSize(1, -1), 1);
  // repeated increments from a default-sentinel 0 land on valid values
  let v = 0;
  for (let i = 0; i < 12; i++) v = stepSubBorderSize(v, 1);
  assert.equal(v, 6);
});

test("format trims floating point noise", () => {
  assert.equal(formatSubBorderSize(0), "0px");
  assert.equal(formatSubBorderSize(3.5), "3.5px");
  assert.equal(formatSubBorderSize(2), "2px");
  assert.equal(formatSubBorderSize(0.1 + 0.2), "0.3px");
});

test("HTML5 subtitle outlines preserve fractional radii", () => {
  const integer = buildSubtitleOutline("#000000", 3);
  const fractional = buildSubtitleOutline("#000000", 3.5);
  assert.notEqual(fractional, integer);
  assert.ok(fractional.split(", ").length > integer.split(", ").length);
  assert.equal(buildSubtitleOutline("#000000", 3.5), fractional);
});
