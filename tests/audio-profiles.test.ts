// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { buildAudioFilterChain, resolveAudioProfileId } from "../src/lib/player/audio-profiles.ts";

test("saved pre-Night Strong profile IDs still load unchanged", () => {
  const existingProfiles = ["off", "bass", "voice", "bass-reduce", "night"];
  assert.deepEqual(existingProfiles.map(resolveAudioProfileId), existingProfiles);
});

test("Flat without normalization adds no Harbor audio filters", () => {
  assert.equal(buildAudioFilterChain("off", false), "");
});

test("Night keeps its existing compressor and places the limiter last", () => {
  assert.equal(
    buildAudioFilterChain("night", false),
    "lavfi=[acompressor=ratio=3:threshold=-20dB:attack=20:release=300:makeup=4dB],lavfi=[alimiter=limit=0.97]",
  );
});

test("Night Strong compresses harder and reshapes the low and high ends", () => {
  assert.equal(
    buildAudioFilterChain("night-strong", false),
    "lavfi=[highpass=f=45,bass=g=-6:f=110:w=0.6,acompressor=ratio=6:threshold=-28dB:attack=5:release=250:knee=8:makeup=12dB,equalizer=f=2200:t=q:w=1.1:g=4,treble=g=-4:f=9000:w=0.5],lavfi=[alimiter=limit=0.97]",
  );
});

test("normalization adds dynaudnorm followed by the limiter", () => {
  assert.equal(
    buildAudioFilterChain("off", true),
    "dynaudnorm=f=500:g=31:p=0.9:m=4,lavfi=[alimiter=limit=0.97]",
  );
});

test("normalization runs before Night Strong and keeps the limiter last", () => {
  assert.equal(
    buildAudioFilterChain("night-strong", true),
    "dynaudnorm=f=500:g=31:p=0.9:m=4,lavfi=[highpass=f=45,bass=g=-6:f=110:w=0.6,acompressor=ratio=6:threshold=-28dB:attack=5:release=250:knee=8:makeup=12dB,equalizer=f=2200:t=q:w=1.1:g=4,treble=g=-4:f=9000:w=0.5],lavfi=[alimiter=limit=0.97]",
  );
});

test("existing shaping profiles keep their current filter chains", () => {
  assert.deepEqual(
    ["bass", "voice", "bass-reduce"].map((profile) => buildAudioFilterChain(profile, false)),
    [
      "lavfi=[bass=g=7:f=110:w=0.6],lavfi=[alimiter=limit=0.97]",
      "lavfi=[equalizer=f=300:t=q:w=1:g=-3,equalizer=f=2800:t=q:w=1:g=5],lavfi=[alimiter=limit=0.97]",
      "lavfi=[bass=g=-8:f=110:w=0.6],lavfi=[alimiter=limit=0.97]",
    ],
  );
});

test("an unknown profile falls back to Flat without disabling normalization", () => {
  assert.equal(resolveAudioProfileId("unknown-profile"), "off");
  assert.equal(buildAudioFilterChain("unknown-profile", false), "");
  assert.equal(
    buildAudioFilterChain("unknown-profile", true),
    "dynaudnorm=f=500:g=31:p=0.9:m=4,lavfi=[alimiter=limit=0.97]",
  );
});
