// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { TrackInfo } from "../src/lib/player/bridge.ts";
import { pickBestMatch, rankByRelease } from "../src/components/player/subtitle-menu/best-match.ts";
import { releaseCompatibilityPercent } from "../src/lib/subtitles/release-match.ts";
import { streamTagsOf } from "../src/lib/subtitles/stream-hints.ts";

function track(overrides: Partial<TrackInfo>): TrackInfo {
  return {
    id: "track",
    label: "Subtitle",
    kind: "subtitle",
    selected: false,
    ...overrides,
  };
}

const blurayHints = {
  release: "Movie.2024.2160p.BluRay.REMUX-FraMeSToR",
  source: "BluRay REMUX",
  resolution: "2160p",
};

test("embedded tracks are never presented as the downloadable best match", () => {
  const embedded = track({ id: "embedded", external: false, matchConfidence: "exact" });
  const external = track({
    id: "external",
    external: true,
    release: "Movie.2024.2160p.BluRay-FraMeSToR",
    matchConfidence: "high",
    matchScore: 140,
  });

  assert.equal(pickBestMatch([embedded, external], blurayHints)?.track.id, "external");
  assert.equal(pickBestMatch([embedded], blurayHints), null);
});

test("a synchronized external track remains the best match without stream hints", () => {
  const ordinary = track({
    id: "ordinary",
    external: true,
    title: "OpenSubtitles V3 #1",
    matchConfidence: "high",
    matchScore: 160,
  });
  const synced = track({
    id: "synced",
    external: true,
    title: "Synced (SRT) · Movie.2024.2160p.BluRay",
  });

  assert.equal(pickBestMatch([ordinary, synced], null)?.track.id, "synced");
});

test("release compatibility uses absolute non-overlapping confidence bands", () => {
  assert.equal(releaseCompatibilityPercent("exact", 0), 100);
  assert.equal(releaseCompatibilityPercent("high", 45), 80);
  assert.equal(releaseCompatibilityPercent("medium", 45), 59);
  assert.equal(releaseCompatibilityPercent("low", 45), 33);
  assert.equal(releaseCompatibilityPercent("incompatible", 90), 17);
});

test("release compatibility reflects source and cut evidence instead of list position", () => {
  const sameRelease = track({
    id: "same-release",
    external: true,
    release: "Movie.2024.2160p.BluRay.REMUX-FraMeSToR",
  });
  const wrongSource = track({
    id: "wrong-source",
    external: true,
    release: "Movie.2024.1080p.WEB-DL-GROUP",
  });

  const ranked = rankByRelease([wrongSource, sameRelease], blurayHints);
  assert.equal(ranked[0].track.id, "same-release");
  assert.ok(ranked[0].compatibilityPercent >= 90);
  assert.ok(ranked[1].compatibilityPercent < 20);
});

test("a generic stream source does not override a more precise remux release", () => {
  const tags = streamTagsOf({
    release: "Movie.2024.2160p.BluRay.REMUX-FraMeSToR",
    source: "BluRay",
    resolution: "4K",
  });

  assert.equal(tags.source, "remux");
  assert.equal(tags.resolution, "2160p");
});

test("release compatibility stays unknown when an addon exposes no release evidence", () => {
  const genericAddonTracks = [
    track({
      id: "addon-1",
      external: true,
      title: "AIOStreams | ElfHosted",
      provider: "AIOStreams | ElfHosted",
      matchScore: 2,
      matchConfidence: "low",
    }),
    track({
      id: "addon-2",
      external: true,
      title: "AIOStreams | ElfHosted",
      provider: "AIOStreams | ElfHosted",
      matchScore: 2,
      matchConfidence: "low",
    }),
  ];

  const ranked = rankByRelease(genericAddonTracks, blurayHints);
  assert.deepEqual(
    ranked.map((match) => match.compatibilityPercent),
    [undefined, undefined],
  );
});

test("a video-derived addon display title is never treated as subtitle release evidence", () => {
  const fallback = track({
    id: "addon-video-fallback",
    external: true,
    title: "Spider-Man · REMUX · 2160p · Dolby Vision · Atmos",
    provider: "AIOStreams | ElfHosted",
    matchScore: 2,
    matchConfidence: "low",
  });

  const [ranked] = rankByRelease([fallback], blurayHints);
  assert.equal(ranked.compatibilityPercent, undefined);
  assert.equal(pickBestMatch([fallback], blurayHints), null);
});

test("source family alone is not promoted to a high-confidence timing match", () => {
  const genericRemux = track({
    id: "generic-remux",
    external: true,
    release: "Movie.2024.2160p.BluRay.REMUX",
  });

  const [ranked] = rankByRelease([genericRemux], blurayHints);
  assert.equal(ranked.confidence, "medium");
  assert.equal(pickBestMatch([genericRemux], blurayHints), null);
});

test("neutral stored fallback does not override release details available on the track", () => {
  const detailed = track({
    id: "detailed",
    external: true,
    release: "Movie.2024.2160p.BluRay.REMUX-FraMeSToR",
    matchScore: 2,
    matchConfidence: "low",
  });

  const [ranked] = rankByRelease([detailed], blurayHints);
  assert.equal(ranked.confidence, "high");
  assert.ok((ranked.compatibilityPercent ?? 0) >= 90);
});

test("an explicit resolution mismatch cannot look like a high-confidence release match", () => {
  const lowerResolution = track({
    id: "lower-resolution",
    external: true,
    release: "Movie.2024.1080p.BluRay.REMUX-FraMeSToR",
    matchScore: 170,
    matchConfidence: "high",
  });

  const [ranked] = rankByRelease([lowerResolution], blurayHints);
  assert.equal(ranked.compatibilityPercent, 74);
  assert.ok(ranked.reasons.includes("subtitle is 1080p, video is 2160p"));
});

test("stored provider confidence cannot hide an explicit source mismatch", () => {
  const wrongSource = track({
    id: "stale-provider-score",
    external: true,
    release: "Movie.2024.2160p.WEB-DL-GROUP",
    matchScore: 220,
    matchConfidence: "high",
  });

  const [ranked] = rankByRelease([wrongSource], blurayHints);
  assert.equal(ranked.confidence, "incompatible");
  assert.ok((ranked.compatibilityPercent ?? 100) < 20);
  assert.ok(ranked.reasons.includes("webdl timing differs from remux"));
});
