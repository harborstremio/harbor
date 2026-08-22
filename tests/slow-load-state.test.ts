// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  advanceSlowLoadSessionState,
  hasPlaybackStarted,
  initialSlowLoadSessionState,
  shouldArmSlowLoadWarning,
} from "../src/views/player/slow-load-state.ts";

const autoRetrySource = readFileSync(
  new URL("../src/views/player/hooks/use-auto-retry.ts", import.meta.url),
  "utf8",
);

test("unknown-duration streams stop the warning after playback advances", () => {
  const playbackStarted = hasPlaybackStarted({ positionSec: 0.6, bufferedSec: 0 });

  assert.equal(playbackStarted, true);
  assert.equal(
    shouldArmSlowLoadWarning({
      isLocal: false,
      playbackStarted,
      playbackSuspended: false,
    }),
    false,
  );
});

test("remote streams keep the warning armed before playback advances", () => {
  const playbackStarted = hasPlaybackStarted({ positionSec: 0, bufferedSec: 0 });

  assert.equal(playbackStarted, false);
  assert.equal(
    shouldArmSlowLoadWarning({
      isLocal: false,
      playbackStarted,
      playbackSuspended: false,
    }),
    true,
  );
});

test("prebuffering alone does not count as playback starting", () => {
  const playbackStarted = hasPlaybackStarted({ positionSec: 0, bufferedSec: 30 });

  assert.equal(playbackStarted, false);
  assert.equal(
    shouldArmSlowLoadWarning({
      isLocal: false,
      playbackStarted,
      playbackSuspended: false,
    }),
    true,
  );
});

test("local streams never arm the warning", () => {
  assert.equal(
    shouldArmSlowLoadWarning({
      isLocal: true,
      playbackStarted: false,
      playbackSuspended: false,
    }),
    false,
  );
});

test("a started source stays started after a seek back to zero", () => {
  let state = initialSlowLoadSessionState("https://stream.example/one");
  state = advanceSlowLoadSessionState(state, {
    sourceUrl: state.sourceUrl,
    playbackStartedNow: true,
  });
  state = advanceSlowLoadSessionState(state, {
    sourceUrl: state.sourceUrl,
    playbackStartedNow: false,
  });

  assert.equal(state.playbackStarted, true);
});

test("changing sources resets the playback-started latch", () => {
  let state = initialSlowLoadSessionState("https://stream.example/one");
  state = advanceSlowLoadSessionState(state, {
    sourceUrl: state.sourceUrl,
    playbackStartedNow: true,
  });
  state = advanceSlowLoadSessionState(state, {
    sourceUrl: "https://stream.example/two",
    playbackStartedNow: true,
  });

  assert.deepEqual(state, {
    sourceUrl: "https://stream.example/two",
    playbackStarted: false,
  });
});

test("paused streams do not arm a slow-load warning", () => {
  assert.equal(
    shouldArmSlowLoadWarning({
      isLocal: false,
      playbackStarted: false,
      playbackSuspended: true,
    }),
    false,
  );
});

test("the hook cancels the old timer when playback starts", () => {
  assert.match(autoRetrySource, /clearTimeout\(t\)/);
  assert.match(autoRetrySource, /\[src\.url, playbackStartedNow, isLocal, snap\.status\]/);
  assert.doesNotMatch(autoRetrySource, /snap\.durationSec\s*>\s*0\s*&&\s*hasProgress/);
});
