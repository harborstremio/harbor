import test from "node:test";
import assert from "node:assert/strict";
import { isNaturalEnd, isTruncatedEnd } from "../src/lib/player/playback-end.ts";
import type { PlayerSnapshot } from "../src/lib/player/bridge.ts";

const snap = (status: string, durationSec: number): PlayerSnapshot =>
  ({ status, durationSec }) as unknown as PlayerSnapshot;

test("an EOF near the end of a known duration is a real ending", () => {
  assert.equal(isNaturalEnd(snap("ended", 2400), 2400), true);
  assert.equal(isNaturalEnd(snap("ended", 2400), 2280), true);
  assert.equal(isNaturalEnd(snap("ended", 2400), 2040), true);
});

test("an EOF far from the end is a broken stream, not an ending", () => {
  assert.equal(isNaturalEnd(snap("ended", 2400), 1200), false);
  assert.equal(isNaturalEnd(snap("ended", 2400), 60), false);
  assert.equal(isTruncatedEnd(snap("ended", 2400), 1200), true);
});

test("without a duration the player is trusted", () => {
  assert.equal(isNaturalEnd(snap("ended", 0), 500), true);
  assert.equal(isNaturalEnd(snap("ended", Number.NaN), 500), true);
  assert.equal(isTruncatedEnd(snap("ended", 0), 500), false);
});

test("nothing but an ended status counts as an ending", () => {
  for (const s of ["playing", "paused", "buffering", "idle"]) {
    assert.equal(isNaturalEnd(snap(s, 2400), 2400), false);
    assert.equal(isTruncatedEnd(snap(s, 2400), 10), false);
  }
});
