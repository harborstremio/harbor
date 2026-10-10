// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  downloadableSeasonPacks,
  isDownloadableSeasonPack,
  seasonPackFileMatchesEpisode,
  streamForSeasonPackEpisode,
} from "../src/lib/download/season-pack.ts";

test("season download picker only shows torrent season packages", () => {
  const packageWithHash = {
    seasonPack: true,
    season: 2,
    infoHash: "abc123",
    name: "Season pack",
  };
  const wrongSeason = {
    seasonPack: true,
    season: 3,
    infoHash: "ghi789",
    name: "Wrong season",
  };
  const packageWithoutHash = {
    seasonPack: true,
    season: 2,
    name: "Direct episode source",
  };
  const singleEpisode = {
    seasonPack: false,
    season: 2,
    infoHash: "def456",
    name: "Single episode",
  };

  assert.equal(isDownloadableSeasonPack(packageWithHash), true);
  assert.equal(isDownloadableSeasonPack(packageWithoutHash), false);
  assert.equal(isDownloadableSeasonPack(singleEpisode), false);
  assert.equal(isDownloadableSeasonPack(wrongSeason, 2), false);
  assert.deepEqual(
    downloadableSeasonPacks([packageWithHash, wrongSeason, packageWithoutHash, singleEpisode], 2),
    [packageWithHash],
  );
});

test("each episode resolves from the selected package instead of its first direct file", () => {
  const source = {
    seasonPack: true,
    infoHash: "abc123",
    url: "https://example.test/episode-1.mkv",
    externalUrl: "https://example.test/page",
    ytId: "video",
    nzbUrl: "https://example.test/file.nzb",
    fileIdx: 4,
    size: 20_000_000_000,
    behaviorHints: { filename: "Show.S02E01.mkv", videoSize: 2_000_000_000 },
  } as Parameters<typeof streamForSeasonPackEpisode>[0];

  const resolved = streamForSeasonPackEpisode(source);

  assert.equal(resolved.infoHash, "abc123");
  assert.equal(resolved.seasonPack, true);
  assert.equal(resolved.url, undefined);
  assert.equal(resolved.externalUrl, undefined);
  assert.equal(resolved.ytId, undefined);
  assert.equal(resolved.nzbUrl, undefined);
  assert.equal(resolved.fileIdx, undefined);
  assert.equal(resolved.size, null);
  assert.equal(resolved.behaviorHints?.filename, undefined);
  assert.equal(resolved.behaviorHints?.videoSize, undefined);
  assert.equal(source.fileIdx, 4);
});

test("a fallback file from the package cannot be queued for the wrong episode", () => {
  const episode = { season: 2, episode: 4 };
  assert.equal(seasonPackFileMatchesEpisode("Show.Name.S02E04.1080p.mkv", episode), true);
  assert.equal(seasonPackFileMatchesEpisode("Show.Name.S02E01.1080p.mkv", episode), false);
});
