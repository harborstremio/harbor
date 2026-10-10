// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import { musicTrackQuality } from "../src/lib/music/quality.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const track: MusicTrack = {
  id: "example",
  title: "Example",
  artist: "Artist",
  artwork: "",
  durationSeconds: 180,
  durationLabel: "3:00",
};

test("provider brands and remote paths never imply a quality level", () => {
  for (const connectorId of ["spotify", "jellyfin", "plex", "catalog", "direct", "local"]) {
    assert.equal(
      musicTrackQuality({
        ...track,
        connectorId,
        sourceId: "https://server.example/music.flac",
        playbackUrl: "https://server.example/music.wav",
      }),
      null,
    );
  }
});

test("local file extensions show only format, including ambiguous containers", () => {
  for (const [location, label] of [
    ["C:\\Music\\one.FLAC", "FLAC"],
    ["/music/two.wav", "WAV"],
    ["file:///C:/Music/three%20four.m4a", "M4A"],
    ["\\\\server\\music\\five.wv", "WavPack"],
  ]) {
    const quality = musicTrackQuality({ ...track, connectorId: "local", sourceId: location });
    assert.equal(quality?.label, label);
    assert.equal(quality?.tier, "unverified");
    assert.equal(quality?.hiFi, false);
  }
});

test("high resolution requires verified lossless codec and source depth plus rate", () => {
  const hiRes = musicTrackQuality({
    ...track,
    quality: {
      codec: "flac",
      sampleRateHz: 96_000,
      bitDepth: 24,
      bitrateKbps: 2512,
    },
  });
  assert.equal(hiRes?.tier, "hi-res");
  assert.equal(hiRes?.detail, "FLAC · 24-bit / 96 kHz · 2512 kbps");
  assert.equal(musicTrackQuality({ ...track, quality: { codec: "alac" } })?.tier, "lossless");
  for (const [sampleRateHz, bitDepth] of [
    [48_000, 24],
    [96_000, 16],
    [96_000, undefined],
    [44_100, 16],
  ]) {
    assert.equal(
      musicTrackQuality({ ...track, quality: { codec: "flac", sampleRateHz, bitDepth } })?.tier,
      "lossless",
    );
  }
  assert.equal(
    musicTrackQuality({
      ...track,
      quality: {
        codec: "flac",
        sampleRateHz: 22_050,
        bitDepth: 16,
      },
    })?.hiFi,
    false,
  );
});

test("decoder codec takes precedence over the source extension and contradictory flags", () => {
  const quality = musicTrackQuality({
    ...track,
    connectorId: "local",
    sourceId: "/music/song.flac",
    quality: { codec: "aac", lossless: true, sampleRateHz: 48_000, bitDepth: 32, bitrateKbps: 256 },
  });
  assert.equal(quality?.tier, "lossy");
  assert.equal(quality?.bitDepth, null);
  assert.equal(quality?.detail, "AAC · 48 kHz · 256 kbps");
  assert.equal(
    musicTrackQuality({
      ...track,
      quality: {
        codec: "flac",
        lossless: false,
        sampleRateHz: 44_100,
        bitDepth: 16,
      },
    })?.hiFi,
    false,
  );
});

test("hybrid and unspecified containers do not prove lossless audio", () => {
  for (const codec of ["wavpack", "wav", "unknown"]) {
    assert.equal(
      musicTrackQuality({ ...track, quality: { codec, sampleRateHz: 96_000, bitDepth: 24 } })?.hiFi,
      false,
    );
  }
  assert.equal(
    musicTrackQuality({
      ...track,
      quality: {
        codec: "wavpack",
        lossless: true,
        sampleRateHz: 44_100,
        bitDepth: 16,
      },
    })?.hiFi,
    true,
  );
});

test("invalid measurements are ignored and bitrate alone never promises Hi-Fi", () => {
  assert.equal(
    musicTrackQuality({
      ...track,
      quality: {
        codec: "flac",
        sampleRateHz: Infinity,
        bitDepth: NaN,
        bitrateKbps: -1,
      },
    })?.tier,
    "lossless",
  );
  const quality = musicTrackQuality({ ...track, quality: { bitrateKbps: 320 } });
  assert.equal(quality?.label, "320 kbps");
  assert.equal(quality?.tier, "unverified");
  assert.equal(quality?.hiFi, false);
});

test("Opus and other lossy codecs never inherit decoder depth or Hi-Res from a high rate", () => {
  for (const codec of ["opus", "aac", "mp3", "vorbis"]) {
    const quality = musicTrackQuality({
      ...track,
      quality: { codec, lossless: true, sampleRateHz: 192_000, bitDepth: 32, bitrateKbps: 640 },
    });
    assert.equal(quality?.tier, "lossy");
    assert.equal(quality?.bitDepth, null);
    assert.equal(quality?.hiFi, false);
    assert.doesNotMatch(quality?.detail ?? "", /bit\b/);
  }
});
