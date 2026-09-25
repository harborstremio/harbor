import assert from "node:assert/strict";
import test from "node:test";
import { returnToActivePlayback } from "../src/lib/player/return-to-playback";
import type { PlayerSnapshot } from "../src/lib/player/bridge";

function fixture(status: PlayerSnapshot["status"]) {
  const calls: unknown[] = [];
  return {
    calls,
    controls: {
      exitPip: async () => {
        calls.push("exit-pip");
      },
      isCurrent: () => true,
      canControl: true,
      status: () => status,
      seekTo: (position: number) => {
        calls.push(["seek", position]);
      },
      playPause: () => {
        calls.push("toggle");
      },
      focus: () => {
        calls.push("focus");
      },
    },
  };
}

test("explicit active EOF restart uses seek and play controls without opening a session", async () => {
  const { calls, controls } = fixture("ended");
  await returnToActivePlayback({ restart: true }, controls);
  assert.deepEqual(calls, ["exit-pip", ["seek", 0], "toggle", "focus"]);
});

test("paused return preserves its position; playing return cannot accidentally pause", async () => {
  const paused = fixture("paused");
  await returnToActivePlayback({}, paused.controls);
  assert.deepEqual(paused.calls, ["exit-pip", "toggle", "focus"]);
  const playing = fixture("playing");
  await returnToActivePlayback({}, playing.controls);
  assert.deepEqual(playing.calls, ["exit-pip", "focus"]);
});

test("late return and unavailable controls cannot seek or play", async () => {
  const stale = fixture("ended");
  stale.controls.exitPip = async () => {
    stale.controls.isCurrent = () => false;
  };
  await assert.rejects(returnToActivePlayback({ restart: true }, stale.controls), /changed/);
  assert.deepEqual(stale.calls, []);
  const forbidden = fixture("ended");
  forbidden.controls.canControl = false;
  await assert.rejects(
    returnToActivePlayback({ restart: true }, forbidden.controls),
    /not available/,
  );
  assert.deepEqual(forbidden.calls, ["exit-pip"]);
});
