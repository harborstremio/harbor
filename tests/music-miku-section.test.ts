import assert from "node:assert/strict";
import test from "node:test";
import { createMikuGroove } from "../src/lib/music/miku-motion";
import { createMikuDance } from "../src/lib/music/miku-dance";
import type { MusicAudioMeterState } from "../src/lib/music/audio-meter";

function drums(now: number, period: number, hard: boolean): MusicAudioMeterState {
  const kick = now % period < 65;
  const bass = hard ? (kick ? -4 : -38) : (kick ? -43 : -56);
  return { status: "ready", data: {
    trackId: "current", connectorId: "local", active: true,
    channels: [{ rmsDb: -10, peakDb: -4 }],
    // The vocal stays loud even through the softer intro and breakdown.
    spectrumDb: [bass, bass - 2, bass - 6, -8, -13, -20, -40, -45],
    outputSampleRateHz: null, outputChannels: null, outputDevice: null, outputBackend: null,
  } };
}

test("real measured drums earn a sustained drop dance; a loud vocal cannot extend the breakdown", () => {
  for (const period of [350, 500, 650]) {
    const groove = createMikuGroove(), dance = createMikuDance();
    let previous = "listening", firstStart = 0, firstEnd = 0;
    const routines: number[] = [];
    for (let now = 0; now < 100000; now += 10) {
      const hard = (now >= 12000 && now < 44000) || (now >= 70000 && now < 94000);
      if (now % 50 === 0) groove.sample(drums(now, period, hard), "current", "local", now);
      const pulse = groove.advance(10, true);
      const state = dance.advance(10, pulse, true, true);
      if (now < 12000) assert.equal(state.stage, "listening", "quiet drums under a loud vocal are not a drop");
      if (state.stage === "dancing" && previous !== "dancing") {
        if (!firstStart) firstStart = now;
        routines.push(state.kind);
      }
      if (state.stage === "leaving" && previous === "dancing" && !firstEnd) firstEnd = now;
      // The established exit-start bound remains 49.5 s below. At the
      // slowest 650 ms beat, the authored return rounds to 2 beats (1.3 s),
      // then recovers for 320 ms: 49.5 + 1.3 + .32 = 51.12 s (+ a sample).
      // The 50 s assertion checks choreography has ended; 52 s checks rest.
      if (now > 50000 && now < 70000) assert.notEqual(state.stage, "dancing");
      if (now > 52000 && now < 70000) assert.equal(state.stage, "listening");
      previous = state.stage;
    }
    assert.ok(firstStart >= 12000 && firstStart < 18500, `${period}ms: dance joins the stronger phrase at ${firstStart}`);
    assert.ok(firstEnd >= 44000 && firstEnd < 49500, `${period}ms: finish the loop after the breakdown at ${firstEnd}`);
    assert.deepEqual(routines, [0, 1], "the next drop earns the other approved routine");
  }
});

test("short drum fills keep a highlight, while sustained quiet or missing audio ends it", () => {
  const groove = createMikuGroove();
  let pulse = groove.advance(0);
  for (let now = 0; now < 12000; now += 10) {
    if (now % 50 === 0) groove.sample(drums(now, 400, now < 7000 || now >= 7350), "current", "local", now);
    pulse = groove.advance(10, true);
    if (now > 5000) assert.ok(pulse.highlight, "a one-beat fill must not end the section");
  }
  for (let now = 12000; now < 17000; now += 10) pulse = groove.advance(10, false);
  assert.equal(pulse.highlight, false);
});

test("after repeated seek gaps the new drum tempo is acquired without keeping pre-seek history", () => {
  const groove = createMikuGroove();
  let now = 1000;
  for (const period of [750, 350, 600, 400]) {
    // No rendering reset/toggle: the same live groove receives inactive seek data.
    for (let gap = 0; gap < 1600; gap += 10, now += 10) {
      if (gap % 50 === 0) {
        const state = drums(now, period, true); state.data!.active = false;
        groove.sample(state, "current", "local", now);
      }
      groove.advance(10, false);
    }
    const start = now;
    let locked = 0, nods = new Set<number>();
    for (; now - start < 6000; now += 10) {
      if (now % 50 === 0) groove.sample(drums(now, period, true), "current", "local", now);
      const pulse = groove.advance(10, true);
      if (now - start > 4000) {
        if (pulse.locked && Math.abs(pulse.period! - period) < period * .08) locked++;
        nods.add(Math.round(pulse.bob * 24));
      }
    }
    assert.ok(locked > 170, `recovered ${period}ms tempo after a seek without a feature toggle`);
    assert.ok(nods.size > 10, "fresh measurements visibly restart the nods");
  }
});
