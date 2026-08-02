// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { hasPlaybackStartedForStallCheck } from "../src/lib/player/stall-wait.ts";

test("paused playback is not treated as a stalled stream", () => {
  assert.equal(
    hasPlaybackStartedForStallCheck({
      status: "paused",
      positionSec: 0,
      videoWidth: 0,
      videoHeight: 0,
    }),
    true,
  );
});

test("a decoded frame counts as playback before the clock advances", () => {
  assert.equal(
    hasPlaybackStartedForStallCheck({
      status: "loading",
      positionSec: 0,
      videoWidth: 1920,
      videoHeight: 1080,
    }),
    true,
  );
});

test("a source with no playback evidence remains eligible for stall skipping", () => {
  assert.equal(
    hasPlaybackStartedForStallCheck({
      status: "playing",
      positionSec: 0,
      videoWidth: 0,
      videoHeight: 0,
    }),
    false,
  );
});
