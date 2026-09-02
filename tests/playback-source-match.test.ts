// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  preferredSourceAddonPending,
  streamMatchesReleaseLineage,
  streamMatchesSource,
} from "../src/lib/playback-history.ts";

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

test("next episode keeps the same release group across per-episode torrents", () => {
  const entry = {
    infoHash: "episode-one-hash",
    addonId: "torrentio",
    resolution: "1080p",
    releaseGroup: "SUCCESSFULCRAB",
    source: "WEB-DL",
    savedAt: Date.now(),
  };
  const nextEpisode = {
    infoHash: "episode-two-hash",
    addonId: "torrentio",
    resolution: "1080p",
    releaseGroupNormalized: "SUCCESSFULCRAB",
    source: "WEB-DL",
  };

  assert.equal(streamMatchesSource(nextEpisode, entry), false);
  assert.equal(streamMatchesReleaseLineage(nextEpisode, entry), true);
});

test("next episode keeps the same release group when binge groups are file-specific", () => {
  const entry = {
    addonId: "comet",
    url: "https://debrid.example/episode-one",
    resolution: "1080p",
    releaseGroup: "NTB",
    source: "WEB-DL",
    bingeGroup: "comet|torbox|aaaa1111|3",
    savedAt: Date.now(),
  };
  const nextEpisode = {
    addonId: "comet",
    resolution: "1080p",
    releaseGroupNormalized: "NTB",
    source: "WEB-DL",
    behaviorHints: { bingeGroup: "comet|torbox|bbbb2222|4" },
  };

  assert.equal(streamMatchesSource(nextEpisode, entry), false);
  assert.equal(streamMatchesReleaseLineage(nextEpisode, entry), true);
});

test("next episode does not cross addons, release groups, or unparsed titles", () => {
  const entry = {
    infoHash: "episode-one-hash",
    addonId: "comet",
    resolution: "1080p",
    releaseGroup: "NTB",
    source: "WEB-DL",
    savedAt: Date.now(),
  };
  const otherAddon = {
    infoHash: "episode-two-hash",
    addonId: "torrentio",
    resolution: "1080p",
    releaseGroupNormalized: "NTB",
    source: "WEB-DL",
  };
  const otherGroup = {
    infoHash: "episode-two-hash",
    addonId: "comet",
    resolution: "1080p",
    releaseGroupNormalized: "FLUX",
    source: "WEB-DL",
  };
  const unknownGroup = {
    infoHash: "episode-two-hash",
    addonId: "comet",
    resolution: "1080p",
    releaseGroupNormalized: null,
    source: "WEB-DL",
  };
  const entryWithoutGroup = { ...entry, releaseGroup: null };

  assert.equal(streamMatchesReleaseLineage(otherAddon, entry), false);
  assert.equal(streamMatchesReleaseLineage(otherGroup, entry), false);
  assert.equal(streamMatchesReleaseLineage(unknownGroup, entry), false);
  assert.equal(streamMatchesReleaseLineage(otherGroup, entryWithoutGroup), false);
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
