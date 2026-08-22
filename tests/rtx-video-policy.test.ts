// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  isRtxHdrBlocked,
  isRtxHdrEligibleSource,
  isRtxVsrBlocked,
  rtxVsrScaleForSource,
} from "../src/lib/player/rtx-video-policy.ts";

test("blocks RTX HDR when HDR-to-SDR or SVP is active", () => {
  assert.equal(isRtxHdrBlocked(false, false), false);
  assert.equal(isRtxHdrBlocked(true, false), true);
  assert.equal(isRtxHdrBlocked(false, true), true);
});

test("blocks RTX VSR only for SVP; HDR-to-SDR does not contradict it", () => {
  assert.equal(isRtxVsrBlocked(false), false);
  assert.equal(isRtxVsrBlocked(true), true);
});

test("accepts tagged SDR sources and rejects native HDR sources", () => {
  assert.equal(isRtxHdrEligibleSource("bt.1886", "bt.709"), true);
  assert.equal(isRtxHdrEligibleSource(" PQ ", "bt.2020"), false);
  assert.equal(isRtxHdrEligibleSource("hlg", "bt.709"), false);
  assert.equal(isRtxHdrEligibleSource("bt.1886", "bt.2020"), false);
  assert.equal(isRtxHdrEligibleSource(undefined, "bt.709"), false);
});

test("picks the largest VSR scale that keeps output within 3840x2160", () => {
  assert.equal(rtxVsrScaleForSource(854, 480), 4);
  assert.equal(rtxVsrScaleForSource(1280, 720), 3);
  assert.equal(rtxVsrScaleForSource(1920, 1080), 2);
  assert.equal(rtxVsrScaleForSource(2560, 1440), 1.5);
});

test("skips VSR for near-4K sources and invalid dimensions", () => {
  assert.equal(rtxVsrScaleForSource(2560, 1600), null);
  assert.equal(rtxVsrScaleForSource(3840, 2160), null);
  assert.equal(rtxVsrScaleForSource(0, 1080), null);
  assert.equal(rtxVsrScaleForSource(-1920, 1080), null);
  assert.equal(rtxVsrScaleForSource(Number.NaN, 720), null);
  assert.equal(rtxVsrScaleForSource(undefined, 720), null);
});
