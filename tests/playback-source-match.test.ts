// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { streamMatchesSource } from "../src/lib/playback-history.ts";

test("season-pack episodes match by torrent hash when their file-specific binge groups differ", () => {
  const entry = {
    infoHash: "ABCDEF123456",
    fileIdx: 3,
    addonId: "comet",
    resolution: "1080p",
    source: "BluRay",
    bingeGroup: "comet|torbox|abcdef123456|3",
    savedAt: Date.now(),
  };
  const nextEpisode = {
    infoHash: "abcdef123456",
    fileIdx: 4,
    addonId: "comet",
    resolution: "1080p",
    source: "BluRay",
    behaviorHints: { bingeGroup: "comet|torbox|abcdef123456|4" },
  };

  assert.equal(streamMatchesSource(nextEpisode, entry), true);
});

test("different known torrent hashes do not match through broader source metadata", () => {
  const entry = {
    infoHash: "pack-one",
    addonId: "torrentio",
    resolution: "1080p",
    source: "WEB-DL",
    bingeGroup: "shared-group",
    savedAt: Date.now(),
  };
  const differentRelease = {
    infoHash: "pack-two",
    addonId: "torrentio",
    resolution: "1080p",
    source: "WEB-DL",
    behaviorHints: { bingeGroup: "shared-group" },
  };

  assert.equal(streamMatchesSource(differentRelease, entry), false);
});
