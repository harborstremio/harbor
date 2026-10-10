import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { MusicAudioMeterState } from "../src/lib/music/audio-meter";
import { createMikuGroove, mikuEnergy, mikuFrame, MIKU_ATLAS } from "../src/lib/music/miku-motion";
import { mikuTempo } from "../src/lib/music/miku-tempo";
import { createMikuRhythm } from "../src/lib/music/miku-rhythm";

function signal(rmsDb = -18, bassDb = rmsDb): MusicAudioMeterState {
  return { status: "ready", data: {
    trackId: "current", connectorId: "local", active: true,
    channels: [{ rmsDb, peakDb: rmsDb + 3 }], spectrumDb: Array(8).fill(bassDb),
    outputSampleRateHz: 48000, outputChannels: "stereo", outputDevice: null, outputBackend: null,
  } };
}

test("Miku rejects old tracks, other sources, missing analysis and silence", () => {
  const state = signal();
  assert.ok(mikuEnergy(state, "current", "local") > 0);
  assert.equal(mikuEnergy(state, "previous", "local"), 0);
  assert.equal(mikuEnergy(state, "current", "spotify"), 0);
  assert.equal(mikuEnergy({ status: "unavailable", data: state.data }, "current", "local"), 0);
  assert.equal(mikuEnergy({ status: "ready", data: null }, "current", "local"), 0);
  state.data!.active = false;
  assert.equal(mikuEnergy(state, "current", "local"), 0);
  assert.equal(mikuEnergy(signal(-80), "current", "local"), 0);
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(mikuEnergy(signal(invalid), "current", "local"), 0);
});

test("head nods follow different measured rhythms without a preset tempo", () => {
  for (const period of [350, 500, 650, 850]) {
    const groove = createMikuGroove();
    const hits: number[] = [];
    let peak = 0;
    for (let now = 0; now < period * 6; now += 50) {
      const kick = now > 0 && now % period === 0;
      if (groove.sample(signal(-20, kick ? -8 : -48), "current", "local", now)) hits.push(now);
      peak = Math.max(peak, groove.advance(50).bob);
    }
    assert.deepEqual(hits, [1, 2, 3, 4, 5].map(n => n * period));
    assert.ok(peak > 0.18 && peak <= 1);
  }
});

test("steady audio and silence do not create invented beat animation", () => {
  const groove = createMikuGroove();
  for (let now = 0; now < 5000; now += 50) {
    assert.equal(groove.sample(signal(), "current", "local", now), false);
    assert.equal(groove.advance(50).bob, 0);
  }
  groove.sample(signal(-20, -60), "current", "local", 5100);
  assert.equal(groove.sample(signal(-10, -5), "current", "local", 5150), true);
  assert.ok(groove.advance(50).bob > 0);
  for (let n = 0; n < 35; n++) groove.advance(50);
  assert.equal(groove.advance(50).bob, 0);
  groove.reset();
  assert.equal(groove.advance(50).bob, 0);
});

test("a transient changes head velocity without snapping its position", () => {
  const groove = createMikuGroove();
  groove.sample(signal(-30, -60), "current", "local", 0);
  groove.sample(signal(-10, -5), "current", "local", 50);
  assert.equal(groove.advance(0).bob, 0);
  const after = groove.advance(16).bob;
  assert.ok(after > 0 && after < 0.3);
});

test("changing a song clears its beat estimate without snapping the visible head pose", () => {
  const groove = createMikuGroove();
  for (let now = 0; now < 12000; now += 16) {
    if (now % 4 === 0) groove.sample(signal(-18, now % 496 < 64 ? -8 : -48), "current", "local", now);
    groove.advance(16);
  }
  const before = groove.advance(0);
  groove.reset(true);
  const reset = groove.advance(0);
  assert.equal(reset.bob, before.bob);
  assert.equal(reset.sway, before.sway);
  assert.equal(reset.period, null);
  for (let n = 0; n < 180; n++) groove.advance(16, false);
  assert.equal(groove.advance(0).bob, 0);
  groove.reset();
  assert.equal(groove.advance(0).sway, 0);
});

test("audible drum accents produce visible nods before tempo locks, with lighter quiet percussion", () => {
  const accent = (quiet: boolean) => {
    const groove = createMikuGroove();
    groove.sample(signal(-18, quiet ? -54 : -24), "current", "local", 0);
    assert.equal(groove.sample(signal(-18, quiet ? -42 : -12), "current", "local", 50), true);
    let peak = 0;
    for (let i = 0; i < 30; i++) {
      const pose = groove.advance(10);
      assert.equal(pose.locked, false);
      peak = Math.max(peak, pose.bob);
    }
    return peak;
  };
  const hard = accent(false), gentle = accent(true);
  assert.ok(hard > .3, `a hard isolated drum should visibly dip the head: ${hard}`);
  assert.ok(gentle > .1 && hard > gentle * 1.3, `quiet percussion should stay lighter: ${gentle}/${hard}`);
});

test("reach and nod poses stay within the authored atlas", () => {
  const frames = Array.from({ length: MIKU_ATLAS.reachFrames }, (_, i) => mikuFrame(i / MIKU_ATLAS.reachFrames, 1, 0));
  assert.deepEqual([...frames].sort((a, b) => a - b), frames);
  assert.equal(mikuFrame(0, 1, 0), 0);
  for (const lift of [-1, 0, 0.5, 0.99, 1, 8, NaN]) {
    for (const bob of [-1, 0, 0.5, 1, Infinity]) {
      for (const sway of [-1, 0, 1, NaN]) {
        const frame = mikuFrame(lift, bob, sway);
        assert.ok(Number.isInteger(frame) && frame >= 0 && frame < MIKU_ATLAS.frames);
      }
    }
  }
});

test("a learned beat continues through softer hits and rests on loss of audio", () => {
  const groove = createMikuGroove();
  let frame = groove.advance(0);
  for (let now = 0; now < 6000; now += 50) {
    groove.sample(signal(-20, now % 500 === 0 ? -8 : -48), "current", "local", now);
    frame = groove.advance(50);
  }
  assert.ok(frame.locked && frame.period && Math.abs(frame.period - 500) < 30);
  const carried: number[] = [];
  for (let now = 6000; now < 7500; now += 50) {
    groove.sample(signal(-25, -42), "current", "local", now);
    carried.push(groove.advance(50).bob);
  }
  assert.ok(Math.max(...carried) - Math.min(...carried) > 0.1);
  for (let n = 0; n < 50; n++) frame = groove.advance(50, false);
  assert.equal(frame.bob, 0);
});

test("faster percussive sections build more energy and breakdowns relax it", () => {
  const perform = (period: number) => {
    const groove = createMikuGroove();
    let frame = groove.advance(0);
    for (let now = 0; now < 12000; now += 50) {
      groove.sample(signal(-18, now % period === 0 ? -8 : -48), "current", "local", now);
      frame = groove.advance(50);
    }
    return { groove, frame };
  };
  const slow = perform(750), fast = perform(350);
  assert.ok(fast.frame.excitement > slow.frame.excitement + 0.1);
  const before = fast.frame.excitement;
  for (let now = 12000; now < 17000; now += 50) {
    fast.groove.sample(signal(-34, -48), "current", "local", now);
    fast.frame = fast.groove.advance(50);
  }
  assert.ok(fast.frame.excitement < before * 0.75);
});

test("valid volume measurements remain usable while the frequency tap recovers", () => {
  const state = signal(-24, -120);
  assert.ok(mikuEnergy(state, "current", "local") > 0.3);
  const groove = createMikuGroove();
  groove.sample(state, "current", "local", 0);
  state.data!.channels[0].rmsDb = -8;
  assert.equal(groove.sample(state, "current", "local", 50), true);
});

test("alternating loud and softer drum accents keep their full tempo, including nightcore", () => {
  for (const period of [250, 300, 350, 400]) {
    const history = Array.from({ length: 128 }, (_, index) => {
      const time = index * 50;
      return { time, flux: time % period === 0 ? (time % (period * 2) === 0 ? .5 : .2) : 0 };
    });
    const tempo = mikuTempo(history, period * 2);
    assert.ok(tempo && Math.abs(tempo.period - period) < 20, `expected ${period}ms, got ${tempo?.period}`);
  }
});

test("true slow drums stay slow when their subdivisions are empty", () => {
  for (const period of [600, 750, 850]) {
    const history = Array.from({ length: 128 }, (_, index) => ({ time: index * 50, flux: index * 50 % period === 0 ? .4 : 0 }));
    const tempo = mikuTempo(history, null);
    assert.ok(tempo && Math.abs(tempo.period - period) < 25, `expected ${period}ms, got ${tempo?.period}`);
  }
});

test("snare attacks between bass kicks count as beats while rapid top-band hats do not double them", () => {
  for (const period of [300, 400, 500]) {
    const groove = createMikuGroove();
    let frame = groove.advance(0);
    for (let now = 0; now < 16000; now += 50) {
      const kick = now % (period * 2) === 0;
      const snare = now % (period * 2) === period;
      const state = signal(-20);
      state.data!.spectrumDb = [kick ? -8 : -52, kick ? -8 : -52, kick ? -12 : -52,
        snare ? -6 : -52, snare ? -6 : -52, snare ? -6 : -52, now % 100 === 0 ? -4 : -55, -40];
      groove.sample(state, "current", "local", now);
      frame = groove.advance(50);
    }
    assert.ok(frame.locked && frame.period && Math.abs(frame.period - period) < 30, `expected ${period}ms, got ${frame.period}`);
  }
});

test("visible nod peaks land close to the drum beat at EDM and hip-hop tempos", () => {
  for (const period of [300, 400, 500, 650, 850]) {
    const groove = createMikuGroove();
    const frames: { time: number; bob: number }[] = [];
    for (let now = 0; now < 18000; now += 10) {
      if (now % 50 === 0) groove.sample(signal(-20, now % period < 50 ? -8 : -52), "current", "local", now);
      frames.push({ time: now + 10, bob: groove.advance(10).bob });
    }
    const peaks = frames.filter((frame, index) => frame.time > 10000 && index > 0 && index < frames.length - 1
      && frame.bob > frames[index - 1].bob && frame.bob >= frames[index + 1].bob);
    assert.ok(Math.abs(peaks.length - 8000 / period) <= 1, "one visible nod per drum beat");
    for (const peak of peaks) {
      const offset = Math.abs(peak.time - Math.round(peak.time / period) * period);
      assert.ok(offset <= 60, `nod drifted ${offset}ms from a ${period}ms drum pulse`);
    }
  }
});

test("hard bass keeps its full pulse and bounce beneath a softer sustained vocal", () => {
  for (const period of [300, 350, 400]) {
    const run = (softVocal: boolean) => {
      const groove = createMikuGroove();
      const frames: ReturnType<typeof groove.advance>[] = [];
      for (let now = 0; now < 18000; now += 50) {
        const kick = now % period === 0;
        const state = signal(softVocal ? -19 : -8);
        const vocal = (softVocal ? -30 : -12) + Math.sin(now / 1800) * 3;
        // A loud, compressed bass bed: both states used to saturate the
        // detector's -10 dB ceiling, hiding these six-dB kick attacks.
        state.data!.spectrumDb = [kick ? -2 : -8, kick ? -4 : -10, kick ? -9 : -17,
          vocal, vocal - 4, vocal - 7, -35, -45];
        groove.sample(state, "current", "local", now);
        const frame = groove.advance(50);
        if (now > 14000) frames.push(frame);
      }
      return frames;
    };
    const loud = run(false), soft = run(true);
    for (const frame of soft) assert.ok(frame.locked && frame.period && Math.abs(frame.period - period) < 25);
    const average = (frames: typeof soft) => frames.reduce((sum, frame) => sum + frame.excitement, 0) / frames.length;
    assert.ok(average(soft) > .5, "hard drums should stay energetic beneath the soft vocal");
    assert.ok(Math.abs(average(soft) - average(loud)) < .03, "vocal loudness must not control drum intensity");
  }
});

test("irregular native meter deliveries retain EDM tempo and a visible full-depth nod", () => {
  for (const period of [60000 / 180, 60000 / 170, 60000 / 140, 60000 / 95]) {
    const groove = createMikuGroove();
    const frames: { time: number; bob: number; period: number | null; locked: boolean }[] = [];
    const gaps = [53, 67, 48, 81, 59, 72, 51];
    let next = 0, delivery = 0;
    for (let now = 0; now < 24000; now += 10) {
      if (now >= next) {
        // Native frequency snapshots have 50 ms windows; IPC delivery is not
        // an exact metronome, and the kick decays into a loud sustained bass.
        const captured = Math.floor((now + 25) / 50) * 50;
        const since = ((captured - 137) % period + period) % period;
        const drum = Math.exp(-since / 65);
        const state = signal(-16);
        state.data!.spectrumDb = [-15 + 13 * drum, -20 + 15 * drum, -27 + 13 * drum,
          -13 + 2 * Math.sin(now / 850), -20, -29, -16, -24];
        groove.sample(state, "current", "local", now);
        next = now + gaps[delivery++ % gaps.length];
      }
      const pose = groove.advance(10);
      if (now > 14000) frames.push({ time: now + 10, ...pose });
    }
    const accurate = frames.filter(frame => frame.locked && frame.period && Math.abs(frame.period - period) < period * .06);
    assert.ok(accurate.length > frames.length * .85, `${Math.round(60000 / period)} BPM: held tempo ${accurate.length}/${frames.length}; last ${frames.at(-1)?.period}`);
    const peaks = frames.filter((frame, index) => index > 0 && index < frames.length - 1 && frame.bob > frames[index - 1].bob && frame.bob >= frames[index + 1].bob);
    assert.ok(Math.abs(peaks.length - 10000 / period) <= 2, `${Math.round(60000 / period)} BPM: one nod per drum: ${peaks.length}`);
    if (period < 450) assert.ok(Math.max(...peaks.map(frame => frame.bob)) > .65, `hard fast drums should use the deeper nod poses: ${Math.max(...peaks.map(frame => frame.bob))}`);
  }
});

test("a missed render frame preserves the musical clock instead of slowing the beat", () => {
  const a = createMikuGroove(), b = createMikuGroove();
  for (let now = 0; now < 10000; now += 50) {
    for (const groove of [a, b]) {
      groove.sample(signal(-20, now % 500 === 0 ? -8 : -48), "current", "local", now);
      groove.advance(50, true, now + 50);
    }
  }
  const delayed = a.advance(200, true, 10200);
  let regular = b.advance(0);
  for (let now = 10010; now <= 10200; now += 10) regular = b.advance(10, true, now);
  assert.ok(delayed.locked && regular.locked);
  assert.ok(Math.abs(delayed.beat - regular.beat) < .001, "elapsed audio time must not be truncated to64ms");
  assert.ok(Math.abs(delayed.bob - regular.bob) < .02, "spring remains stable during bounded catch-up");
});

test("a brief meter outage keeps the learned rhythm available for recovery", () => {
  const groove = createMikuGroove();
  for (let now = 0; now < 10000; now += 50) {
    groove.sample(signal(-20, now % 500 === 0 ? -8 : -48), "current", "local", now);
    groove.advance(50);
  }
  const before = groove.advance(0);
  for (let n = 0; n < 20; n++) groove.advance(50);
  groove.sample(signal(-20, -8), "current", "local", 11000);
  const resumed = groove.advance(16);
  assert.ok(before.period && resumed.period && Math.abs(before.period - resumed.period) < 30,
    "a one-second IPC stall must not discard all learned percussion history");
});

test("an isolated bass hit has a rounded visible recovery instead of a tiny twitch", () => {
  const groove = createMikuGroove();
  groove.sample(signal(-18, -24), "current", "local", 0);
  groove.sample(signal(-18, -12), "current", "local", 50);
  const frames = Array.from({ length: 50 }, () => groove.advance(10).bob);
  assert.ok(Math.max(...frames) > .45);
  assert.ok(frames.filter(bob => bob > .2).length >= 20, "the nod should remain readable for at least200ms");
});

test("recorded syncopated bass and snare measurements retain their shared pulse", () => {
  // Anonymous numeric measurements from the native meter: elapsed ms, RMS,
  // then eight frequency bands. No audio, title or source URL is retained.
  const samples: number[][] = JSON.parse(readFileSync(new URL("./fixtures/music-syncopated-meter.json", import.meta.url), "utf8"));
  const groove = createMikuGroove();
  const poses: ReturnType<typeof groove.advance>[] = [];
  let next = 0;
  for (let now = 0; now < samples.at(-1)![0]; now += 10) {
    while (next < samples.length && samples[next][0] <= now) {
      const [time, rms, ...spectrumDb] = samples[next++];
      const state = signal(rms);
      state.data!.spectrumDb = spectrumDb;
      groove.sample(state, "current", "local", time);
    }
    const pose = groove.advance(10);
    if (now > 6000) poses.push(pose);
  }
  assert.ok(poses.filter(pose => pose.locked).length > poses.length * .95,
    "the multi-beat snare pattern must bridge ambiguous sustained bass");
  const settled = poses.slice(200);
  assert.ok(settled.filter(pose => pose.period && pose.period > 520 && pose.period < 575).length > settled.length * .95,
    "joint drum evidence must converge instead of choosing unrelated isolated lags");
  assert.ok(Math.max(...settled.map(pose => pose.bob)) - Math.min(...settled.map(pose => pose.bob)) > .65);
});

test("perfectly periodic hi-hat leakage cannot establish a drum clock by itself", () => {
  for (const period of [125, 150, 250]) {
    const rhythm = createMikuRhythm();
    for (let time = 0; time < 16000; time += 50) {
      const hat = Math.exp(-(time % period) / 30);
      rhythm.push(time, 0, 0, hat, .001 * hat, .2 * hat);
      if (time % 350 === 0) assert.equal(rhythm.estimate(null), null);
    }
  }
});

test("one weak alternate lag cannot slow an established syncopated pulse", () => {
  const samples: number[][] = JSON.parse(readFileSync(new URL("./fixtures/music-syncopated-alternate-lag.json", import.meta.url), "utf8"));
  const groove = createMikuGroove();
  const periods: number[] = [];
  let next = 0;
  for (let now = 0; now < samples.at(-1)![0]; now += 10) {
    while (next < samples.length && samples[next][0] <= now) {
      const [time, rms, ...spectrumDb] = samples[next++];
      const state = signal(rms);
      state.data!.spectrumDb = spectrumDb;
      groove.sample(state, "current", "local", time);
    }
    const pose = groove.advance(10);
    if (now > 11000) {
      assert.ok(pose.locked && pose.period, "keep the recurring joint drum evidence");
      periods.push(pose.period);
    }
  }
  assert.ok(periods.every(period => period > 525 && period < 555),
    "an isolated weak777ms lag must not pull the measured539ms pulse toward587ms");
});
