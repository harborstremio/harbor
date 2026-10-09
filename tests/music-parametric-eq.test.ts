import test from "node:test";
import assert from "node:assert/strict";
import {
  importPeq,
  exportPeq,
  peqResponse,
  peqHeadroom,
  normalizePeq,
} from "../src/lib/music/parametric-eq.ts";
import { normalizeMusicAudio } from "../src/lib/music/audio-settings.ts";
import { loadListeningProfile } from "../src/lib/music/audio-profiles.ts";

test("correction import round-trips filters and rejects unsupported processing", () => {
  const text =
    "Preamp: -6.5 dB\nFilter 1: ON PK Fc 1000 Hz Gain 6 dB Q 1.4\nFilter 2: OFF LSC Fc 100 Hz Gain -3 dB Q 0.7071";
  const correction = importPeq(text);
  assert.deepEqual(importPeq(exportPeq(correction.filters, correction.preampDb)), correction);
  for (const invalid of [
    text + "\nInclude: secret.txt",
    text + "\nChannel: L",
    text.replace("1000 Hz", "99999 Hz"),
    text.replace("Q 1.4", "Q 0"),
    "Filter 1: ON PK Fc . Hz Gain 6 dB Q 1",
    "",
  ])
    assert.throws(() => importPeq(invalid));
});

test("response and headroom combine overlapping filters and respect strength", () => {
  const filters = normalizePeq([
    { type: "peak", frequency: 1000, gain: 6, q: 1 },
    { type: "peak", frequency: 1000, gain: 6, q: 1 },
  ]);
  assert.ok(Math.abs(peqResponse(filters, 1000) - 12) < 1e-8);
  assert.ok(Math.abs(peqResponse(filters, 1000, 48000, 0.5) - 6) < 1e-8);
  assert.ok(peqHeadroom(filters) >= 12.5);
  assert.equal(peqHeadroom(filters, 0), 0);
  assert.equal(
    peqResponse(
      filters.map((f) => ({ ...f, enabled: false })),
      1000,
    ),
    0,
  );
  assert.ok(peqHeadroom(normalizePeq([{ type: "lowPass", frequency: 1000, q: 6 }])) > 15);
});

test("loading profiles preserves routing and gain ceiling while restoring correction", () => {
  const current = normalizeMusicAudio({
    device: "wasapi/dac",
    volumeLimit: 1,
    sampleRate: 96000,
    exclusive: true,
  });
  const profile = {
    id: "one",
    name: "Headphones",
    settings: normalizeMusicAudio({
      device: "other",
      boostEnabled: true,
      volumeLimit: 5,
      eqMode: "parametric",
      peqFilters: normalizePeq([{ gain: 4 }]),
      preampDb: -4,
    }),
  };
  const loaded = loadListeningProfile(profile, current);
  assert.equal(loaded.device, current.device);
  assert.equal(loaded.volumeLimit, 1);
  assert.equal(loaded.boostEnabled, false);
  assert.equal(loaded.sampleRate, 96000);
  assert.equal(loaded.exclusive, true);
  assert.equal(loaded.preampDb, -4);
  assert.deepEqual(loaded.peqFilters, profile.settings.peqFilters);
});

test("new settings default to neutral and reject nonfinite or unsupported values", () => {
  const value = normalizeMusicAudio({
    preampDb: Infinity,
    eqStrength: NaN,
    crossfeed: -2,
    sampleRate: 12345,
    peqFilters: Array(30).fill({ gain: 99, q: 0, frequency: 1 }),
  });
  assert.equal(value.preampDb, 0);
  assert.equal(value.eqStrength, 1);
  assert.equal(value.crossfeed, 0);
  assert.equal(value.sampleRate, 0);
  assert.equal(value.peqFilters.length, 24);
  assert.deepEqual(value.peqFilters[0], {
    type: "peak",
    gain: 18,
    q: 0.1,
    frequency: 20,
    enabled: true,
  });
});
