import assert from "node:assert/strict";
import test from "node:test";
import { newerCheckpoint, usableCheckpointPosition } from "../src/lib/music/session-checkpoint";

test("an unknown duration no longer throws the resume point away", () => {
  // The old guard was `position < duration - 2`, which for duration 0 meant position < -2,
  // so every track without a known length resumed from zero.
  assert.equal(usableCheckpointPosition(120, 0), 120);
  assert.equal(usableCheckpointPosition(120, undefined), 120);
  assert.equal(usableCheckpointPosition(120, Number.NaN), 120);
});

test("a position inside the track is kept, at or past the end is dropped", () => {
  assert.equal(usableCheckpointPosition(120, 240), 120);
  assert.equal(usableCheckpointPosition(238, 240), 0);
  assert.equal(usableCheckpointPosition(240, 240), 0);
  assert.equal(usableCheckpointPosition(1000, 240), 0);
});

test("nothing meaningful to resume reads as zero", () => {
  assert.equal(usableCheckpointPosition(0, 240), 0);
  assert.equal(usableCheckpointPosition(-5, 240), 0);
  assert.equal(usableCheckpointPosition(undefined, 240), 0);
  assert.equal(usableCheckpointPosition(Number.NaN, 240), 0);
  assert.equal(usableCheckpointPosition(Number.POSITIVE_INFINITY, 240), 0);
});

test("the newer store wins so a stale mirror cannot undo a good checkpoint", () => {
  const older = { key: "a", position: 10, savedAt: 100 };
  const newer = { key: "a", position: 90, savedAt: 200 };
  assert.equal(newerCheckpoint(older, newer), newer);
  assert.equal(newerCheckpoint(newer, older), newer);
});

test("one store being empty is not a reason to lose the other", () => {
  const only = { key: "a", position: 10, savedAt: 100 };
  assert.equal(newerCheckpoint(null, only), only);
  assert.equal(newerCheckpoint(only, null), only);
  assert.equal(newerCheckpoint(null, null), null);
});

test("a checkpoint with no timestamp still loses to one that has a newer stamp", () => {
  const unstamped = { key: "a", position: 10 };
  const stamped = { key: "a", position: 90, savedAt: 5 };
  assert.equal(newerCheckpoint(unstamped, stamped), stamped);
});
