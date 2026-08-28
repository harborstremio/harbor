// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { preferredSourceAddonPending, streamMatchesSource } from "../src/lib/playback-history.ts";

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

test("auto-play waits while the remembered source addon is still loading", () => {
  const entry = {
    addonId: "community.comet",
    resolution: "4K",
    source: "BluRay",
    savedAt: Date.now(),
  };
  const progress = {
    settled: 1,
    total: 2,
    queriedAddonIds: ["community.comet", "com.stremio.torrentio.addon"],
    settledAddonIds: ["com.stremio.torrentio.addon"],
  };

  assert.equal(preferredSourceAddonPending(entry, false, false, progress), true);
});

test("auto-play may fall back after the remembered source addon settles without a match", () => {
  const entry = {
    addonId: "community.comet",
    resolution: "4K",
    source: "BluRay",
    savedAt: Date.now(),
  };
  const progress = {
    settled: 2,
    total: 2,
    queriedAddonIds: ["community.comet", "com.stremio.torrentio.addon"],
    settledAddonIds: ["community.comet", "com.stremio.torrentio.addon"],
  };

  assert.equal(preferredSourceAddonPending(entry, false, false, progress), false);
});

test("auto-play does not wait once the remembered source already matched", () => {
  const entry = {
    addonId: "community.comet",
    resolution: "4K",
    source: "BluRay",
    savedAt: Date.now(),
  };
  const progress = {
    settled: 0,
    total: 1,
    queriedAddonIds: ["community.comet"],
    settledAddonIds: [],
  };

  assert.equal(preferredSourceAddonPending(entry, true, false, progress), false);
});
