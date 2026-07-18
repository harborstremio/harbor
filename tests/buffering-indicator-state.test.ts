// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  advanceBufferingIndicator,
  initialBufferingIndicatorState,
} from "../src/views/player/buffering-indicator-state.ts";

test("shows after buffering continues for 300ms", () => {
  let state = initialBufferingIndicatorState();
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 0,
    positionSec: 20,
  });
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 299,
    positionSec: 20,
  });
  assert.equal(state.visible, false);

  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 300,
    positionSec: 20,
  });
  assert.equal(state.visible, true);
});

test("does not show while playback position keeps advancing", () => {
  let state = initialBufferingIndicatorState();
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 0,
    positionSec: 20,
  });
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 700,
    positionSec: 20.5,
  });
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 1_400,
    positionSec: 21,
  });
  assert.equal(state.visible, false);
});

test("hides immediately when playback advances again", () => {
  let state = initialBufferingIndicatorState();
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 0,
    positionSec: 20,
  });
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 1_000,
    positionSec: 20,
  });
  assert.equal(state.visible, true);

  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 1_050,
    positionSec: 20.2,
  });
  assert.equal(state.visible, false);
});

test("clears pending and visible state when buffering ends", () => {
  let state = initialBufferingIndicatorState();
  state = advanceBufferingIndicator(state, {
    buffering: true,
    eligible: true,
    nowMs: 0,
    positionSec: 20,
  });
  state = advanceBufferingIndicator(state, {
    buffering: false,
    eligible: true,
    nowMs: 800,
    positionSec: 20,
  });

  assert.deepEqual(state, initialBufferingIndicatorState());
});
