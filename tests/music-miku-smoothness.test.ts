import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createMikuGroove } from "../src/lib/music/miku-motion";
import { createMikuDance, MIKU_DANCE } from "../src/lib/music/miku-dance";
import type { MusicAudioMeterState } from "../src/lib/music/audio-meter";

function meter(rmsDb: number, spectrumDb: number[], active = true): MusicAudioMeterState {
  return { status: "ready", data: { trackId: "current", connectorId: "local", active,
    channels: [{ rmsDb, peakDb: rmsDb + 3 }], spectrumDb,
    outputSampleRateHz: 48000, outputChannels: "stereo", outputDevice: null, outputBackend: null } };
}
function recording(name: string) {
  const raw: (number[] | { at: number; state: MusicAudioMeterState })[] = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  const samples = raw.map(row => {
    if (!Array.isArray(row)) return row;
    const [at, rms, ...bands] = row;
    return { at, state: meter(rms, bands) };
  });
  const groove = createMikuGroove();
  const frames: (ReturnType<typeof groove.advance> & { time: number })[] = [];
  let next = 0;
  for (let now = 0; now < samples.at(-1)!.at; now += 10) {
    while (next < samples.length && samples[next].at <= now) {
      const { at, state } = samples[next++];
      groove.sample(state, "current", "local", at);
    }
    frames.push({ time: now + 10, ...groove.advance(10, true, now + 10) });
  }
  return frames;
}

test("a transient octave proposal in captured meter data cannot instantly halve the established animation tempo", () => {
  const frames = recording("music-transient-octave-meter");
  const settled = frames.filter(p => p.time >= 8000);
  const audibleWindow = settled.filter(p => p.time <= 10000);
  assert.ok(audibleWindow.filter(p => p.locked).length > audibleWindow.length * .9);
  // This captured window previously jumped 387.59 -> 784.99 ms at 9.35 s,
  // then abandoned that alternate octave. Test the established pulse through
  // the transient, without claiming ground-truth BPM for the whole recording.
  // Its final meter-delivery gap may unlock the pose; retain that real gap.
  for (const p of settled.filter(p => p.locked)) {
    assert.ok(p.period! > 350 && p.period! < 450, `${p.time}: transient ${p.period} ms octave`);
  }
});

test("phase alignment keeps recorded groove-clock speed within eight percent of its estimated tempo", () => {
  for (const name of ["music-syncopated-meter", "music-syncopated-alternate-lag"]) {
    const frames = recording(name);
    let checked = 0;
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      if (!a.locked || !b.locked || !a.period || !b.period) continue;
      const rate = (b.beat - a.beat) * b.period / (b.time - a.time);
      assert.ok(rate >= .92 - 1e-8 && rate <= 1.08 + 1e-8, `${name}/${b.time}: ${rate}x beat rate`);
      checked++;
    }
    assert.ok(checked > 400, "check sustained measured percussion, not just acquisition");
  }
});

test("neither retained routine inherits a thirty-five-percent speed swing from incoming phase correction", () => {
  for (const kind of [0, 1]) for (const period of [300, 500, 850]) for (const rate of [.65, 1.35]) {
    const dance = createMikuDance(kind); dance.selectTrack("steady-tempo");
    let beat = 0, now = 0;
    const advance = (speed: number) => {
      now += 16; beat += 16 / period * speed;
      return dance.advance(16, { beat, period, locked: true, excitement: .8, highlight: true, danceFit: 1 }, true, true);
    };
    let state = advance(1);
    while (state.stage !== "dancing" && now < 30000) state = advance(1);
    assert.equal(state.stage, "dancing");
    let previous = state.frame, travelled = 0;
    const start = now, frames = MIKU_DANCE.loopFrames[kind];
    while (now - start < 5000) {
      state = advance(rate);
      assert.equal(state.stage, "dancing");
      const step = (state.frame - previous + frames) % frames;
      assert.ok(step <= 3, "no backward movement or skipped phrase");
      travelled += step; previous = state.frame;
    }
    const expected = (now - start) / period * frames / MIKU_DANCE.loopBeats[kind];
    assert.ok(travelled >= expected * .88 - 1 && travelled <= expected * 1.12 + 1,
      `kind ${kind}/${period} ms/${rate}x incoming: ${travelled / expected}x visible rate`);
  }
});

test("smooth correction still follows a real 120-to-172 BPM change and relearns after a seek", () => {
  const groove = createMikuGroove();
  const signal = (now: number, period: number) => {
    const kick = Math.exp(-(now % period) / 60);
    const snare = Math.exp(-(((now - period) % (period * 2) + period * 2) % (period * 2)) / 55);
    return meter(-20, [-48 + kick * 40, -50 + kick * 35, -54 + kick * 28,
      -30 + snare * 8, -35 + snare * 12, -40 + snare * 10, -45, -48]);
  };
  let pulse = groove.advance(0);
  const before: number[] = [], after: number[] = [];
  for (let now = 0; now < 32000; now += 10) {
    const period = now < 16000 ? 500 : 60000 / 172;
    if (now % 50 === 0) groove.sample(signal(now < 16000 ? now : now - 16000, period), "current", "local", now);
    pulse = groove.advance(10, true, now + 10);
    if (now >= 14000 && now < 16000) before.push(pulse.period ?? Infinity);
    if (now >= 26000) after.push(pulse.period ?? Infinity);
  }
  assert.ok(before.every(p => Math.abs(p - 500) < 500 * .08));
  assert.ok(after.every(p => Math.abs(p - 60000 / 172) < 60000 / 172 * .08));
  for (let now = 32000; now < 33500; now += 10) {
    if (now % 50 === 0) groove.sample(meter(-20, [], false), "current", "local", now);
    groove.advance(10, false, now + 10);
  }
  const resumed: number[] = [];
  for (let now = 33500; now < 41500; now += 10) {
    if (now % 50 === 0) groove.sample(signal(now - 33500, 750), "current", "local", now);
    pulse = groove.advance(10, true, now + 10);
    if (now >= 39500 && pulse.locked) resumed.push(pulse.period ?? Infinity);
  }
  assert.ok(resumed.length > 170);
  assert.ok(resumed.every(p => Math.abs(p - 750) < 750 * .08));
});
