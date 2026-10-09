import assert from "node:assert/strict";
import test from "node:test";
import { createMikuDanceFit } from "../src/lib/music/miku-dance-fit";
import { createMikuDance } from "../src/lib/music/miku-dance";
import { createMikuGroove } from "../src/lib/music/miku-motion";
import type { MusicAudioMeterState } from "../src/lib/music/audio-meter";
import { readFileSync } from "node:fs";

function arrangement(pattern: number[], period = 400) {
  const fit = createMikuDanceFit();
  let score = 0;
  for (let time = 0; time < 24000; time += 20) {
    const phase = time / period % 4;
    const kick = pattern.some(p => phase >= p && phase < p + 20 / period - .00001);
    const snare = Math.abs(phase - 1) < .001 || Math.abs(phase - 3) < .001;
    fit.sample(time, kick ? 1 : 0, snare ? .9 : 0);
    score = fit.advance(20, time, time / period, period, true);
  }
  return score;
}

test("regular dance drives earn choreography while syncopated 808 patterns retain the listening groove", () => {
  for (const period of [300, 400, 500, 800]) {
    assert.ok(arrangement([0, 1, 2, 3], period) > .85, `four-on-floor ${period}`);
    assert.ok(arrangement([0, 2], period) > .8, `regular kick/snare ${period}`);
    assert.ok(arrangement([0, .75, 1.5, 2.75, 3.5], period) < .5, `syncopated 808 ${period}`);
    assert.ok(arrangement([2], period) < .6, `sparse one-drop ${period}`);
  }
});

test("tempo alone and missing drum evidence cannot approve a dance", () => {
  const fit = createMikuDanceFit();
  for (let time = 0; time < 30000; time += 20) {
    fit.sample(time, .04, .03);
    assert.equal(fit.advance(20, time, time / 300, 300, true), 0);
  }
});

test("loud grid-aligned drums do not hide quieter syncopated attacks", () => {
  const fit = createMikuDanceFit();
  let score = 0;
  for (let time = 0; time < 24000; time += 20) {
    const beat = time / 400;
    const onBeat = time % 400 === 0;
    const offBeat = [200, 600, 1000].includes(time % 1600);
    fit.sample(time, onBeat ? 1 : offBeat ? .25 : 0, 0);
    score = fit.advance(20, time, beat, 400, true);
  }
  assert.ok(score < .55, "a loud steady layer cannot mask a syncopated drum pattern");
});

test("a loud fast section with poor choreography fit never starts a playful routine", () => {
  const dance = createMikuDance();
  for (let time = 0; time < 60000; time += 20) {
    const p = dance.advance(20, { beat: time / 350, period: 350, locked: true, excitement: .95, highlight: true, danceFit: .35 }, true, true);
    assert.equal(p.stage, "listening");
  }
});

test("recorded syncopated drums keep strong nods without approving playful choreography", () => {
  for (const fixture of ["music-syncopated-meter", "music-syncopated-alternate-lag"]) {
    const samples: number[][] = JSON.parse(readFileSync(new URL(`./fixtures/${fixture}.json`, import.meta.url), "utf8"));
    const groove = createMikuGroove();
    const poses: ReturnType<typeof groove.advance>[] = [];
    let next = 0;
    for (let now = 0; now < samples.at(-1)![0]; now += 10) {
      while (next < samples.length && samples[next][0] <= now) {
        const [time, rmsDb, ...spectrumDb] = samples[next++];
        const state: MusicAudioMeterState = { status: "ready", data: {
          active: true, trackId: "current", connectorId: "local", channels: [{ rmsDb, peakDb: rmsDb + 3 }], spectrumDb,
          outputSampleRateHz: 48000, outputChannels: "stereo", outputDevice: null, outputBackend: null,
        } };
        groove.sample(state, "current", "local", time);
      }
      const pose = groove.advance(10);
      if (now > 11000) poses.push(pose);
    }
    assert.ok(poses.every(p => p.danceFit < .55));
    assert.ok(poses.filter(p => p.locked).length > poses.length * .9);
    assert.ok(Math.max(...poses.map(p => p.bob)) - Math.min(...poses.map(p => p.bob)) > .5);
  }
});
