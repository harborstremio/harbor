import assert from "node:assert/strict";
import test from "node:test";
import {
  episodeSpanContains,
  episodeSpanLabel,
  parseEpisodeSpan,
} from "../src/lib/episode-span.ts";
import { parseFilename } from "../src/lib/local-library.ts";
import { episodeVariantMatch, matchEpisodeFileIndex } from "../src/lib/streams/episode-file.ts";

for (const filename of [
  "Show.S01E01E02.mkv",
  "Show S1E1-E2.mp4",
  "Show.S01E01-02.mkv",
  "Show.1x01-02.mkv",
]) {
  test(`parses dual episode ${filename}`, () => {
    assert.deepEqual(parseEpisodeSpan(filename), { season: 1, episode: 1, episodeEnd: 2 });
    assert.equal(parseFilename(filename).episodeEnd, 2);
  });
}

test("parses the reported Mr Robot filename as a dual-episode show", () => {
  assert.deepEqual(parseFilename("Mr.Robot.S02E01E02.1080p.BluRay.x265.10Bit.6CH-Pahe.in.mkv"), {
    title: "Mr Robot",
    year: null,
    type: "show",
    season: 2,
    episode: 1,
    episodeEnd: 2,
    resolution: "1080p",
  });
});

test("single episodes use the same start and end", () => {
  assert.deepEqual(parseEpisodeSpan("Show.S02E007.1080p.mkv"), {
    season: 2,
    episode: 7,
    episodeEnd: 7,
  });
});

test("classifies season extras without an episode token as Specials", () => {
  assert.deepEqual(parseFilename("Key.and.Peele.S03.EXTRAS.720p.BluRay.x264.mkv"), {
    title: "Key and Peele",
    year: null,
    type: "show",
    season: 0,
    episode: 3,
    episodeEnd: 3,
    resolution: "720p",
  });
});

test("rejects reversed, non-consecutive, cross-season, and bare-number ranges", () => {
  for (const filename of [
    "S01E02-E01.mkv",
    "S01E01-E03.mkv",
    "S01E01-S02E02.mkv",
    "Show.01-02.1080p.mkv",
    "Show.2025-2026.mkv",
  ]) {
    assert.equal(parseEpisodeSpan(filename), null, filename);
  }
});

test("containment and file selection include either covered episode", () => {
  const span = parseEpisodeSpan("Show.S01E01-E02.mkv")!;
  assert.equal(episodeSpanContains(span, 1, 1), true);
  assert.equal(episodeSpanContains(span, 1, 2), true);
  assert.equal(episodeSpanContains(span, 1, 3), false);
  assert.equal(episodeVariantMatch("Show.S01E01-E02.mkv", 1, 2), true);
  assert.equal(
    matchEpisodeFileIndex(["Show.S01E01-E02.mkv", "Show.S01E03.mkv"], { season: 1, episode: 2 }),
    0,
  );
  assert.equal(episodeSpanLabel(span), "S01E01–E02");
});
