import assert from "node:assert/strict";
import test from "node:test";
import { createMikuGroove } from "../src/lib/music/miku-motion";
import type { MusicAudioMeterState } from "../src/lib/music/audio-meter";

function signal(time: number, period: number): MusicAudioMeterState {
  const kick = Math.exp(-(time % period) / 60);
  return { status: "ready", data: {
    trackId: "same-track", connectorId: "local", active: true,
    channels: [{ rmsDb: -20, peakDb: -8 }],
    spectrumDb: [-48 + kick * 40, -50 + kick * 35, -54 + kick * 28, -44, -46, -47, -49, -50],
    outputSampleRateHz: 48000, outputChannels: "stereo", outputDevice: null, outputBackend: null,
  } };
}

function established() {
  const groove = createMikuGroove();
  let pose = groove.advance(0);
  for (let time = 0; time < 16000; time += 10) {
    if (time % 50 === 0) groove.sample(signal(time, 500), "same-track", "local", time);
    pose = groove.advance(10, true, time + 10);
  }
  assert.ok(pose.locked && pose.period && Math.abs(pose.period - 500) < 10);
  return { groove, pose };
}

test("transport suspension preserves the current spring pose and its ordinary release", () => {
  const suspended = established(), ordinaryRelease = established();
  assert.ok(suspended.pose.bob > .1 || Math.abs(suspended.pose.sway) > .1,
    "exercise an actual listening pose, not settled rest");
  suspended.groove.suspend();
  suspended.groove.suspend();
  const immediate = suspended.groove.advance(0, false, 16000);
  assert.equal(immediate.bob, suspended.pose.bob);
  assert.equal(immediate.sway, suspended.pose.sway);
  // A suspend must not zero velocity or otherwise alter the release spring.
  // With no meter delivery, it should have the same visible release as the
  // existing non-driving clock; only the next sample's history is invalidated.
  for (let time = 16000; time < 16500; time += 10) {
    const actual = suspended.groove.advance(10, false, time + 10);
    const expected = ordinaryRelease.groove.advance(10, false, time + 10);
    assert.equal(actual.bob, expected.bob);
    assert.equal(actual.sway, expected.sway);
  }
});

test("short same-track resume learns the audible section without reviving the pre-pause tempo", () => {
  for (const pauseMs of [500, 1000]) for (const newPeriod of [500, 60000 / 172]) {
    const { groove } = established();
    groove.suspend();
    // Match component unsubscribe/reacquire: there is no inactive meter event.
    for (let time = 16000; time < 16000 + pauseMs; time += 10) groove.advance(10, false, time + 10);
    const poses: ReturnType<typeof groove.advance>[] = [];
    for (let elapsed = 0; elapsed < 3500; elapsed += 10) {
      const time = 16000 + pauseMs + elapsed;
      if (elapsed % 50 === 0) groove.sample(signal(elapsed, newPeriod), "same-track", "local", time);
      poses.push(groove.advance(10, true, time + 10));
    }
    assert.equal(poses[0].period, null, "resume must discard the old onset window before re-locking");
    const accurate = (pose: typeof poses[number]) => pose.period !== null && Math.abs(pose.period - newPeriod) < newPeriod * .08;
    assert.ok(poses.filter(p => p.locked).every(accurate), "a stale confident tempo must not drive the resumed section");
    const settled = poses.slice(250);
    assert.ok(settled.filter(p => p.locked && accurate(p)).length >= 90,
      `${pauseMs} ms pause / ${newPeriod} ms period: relearn within 2.5 seconds`);
  }
});
