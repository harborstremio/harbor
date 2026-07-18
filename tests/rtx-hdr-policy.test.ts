// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isRtxHdrBlocked, isRtxHdrEligibleSource } from "../src/lib/player/rtx-hdr-policy.ts";

test("blocks RTX HDR when HDR-to-SDR or SVP is active", () => {
  assert.equal(isRtxHdrBlocked(false, false), false);
  assert.equal(isRtxHdrBlocked(true, false), true);
  assert.equal(isRtxHdrBlocked(false, true), true);
});

test("accepts tagged SDR sources and rejects native HDR sources", () => {
  assert.equal(isRtxHdrEligibleSource("bt.1886", "bt.709"), true);
  assert.equal(isRtxHdrEligibleSource(" PQ ", "bt.2020"), false);
  assert.equal(isRtxHdrEligibleSource("hlg", "bt.709"), false);
  assert.equal(isRtxHdrEligibleSource("bt.1886", "bt.2020"), false);
  assert.equal(isRtxHdrEligibleSource(undefined, "bt.709"), false);
});
