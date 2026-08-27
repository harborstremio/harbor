// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { parseRelease, releaseAffinity } from "../src/lib/subtitles/release-match.ts";

const bluray4k = parseRelease("Movie.2024.2160p.BluRay.REMUX-FraMeSToR");

test("a BluRay or REMUX subtitle ranks above a same-group WEB-DL subtitle", () => {
  const webdlSameGroup = releaseAffinity(bluray4k, "Movie.2024.2160p.WEB-DL.DV.HDR-FraMeSToR");
  const blurayDifferentGroup = releaseAffinity(
    bluray4k,
    "Movie.2024.2160p.BluRay.DV.HDR-OtherGroup",
  );

  assert.equal(webdlSameGroup.sourceRank, 1);
  assert.equal(blurayDifferentGroup.sourceRank, 2);
  assert.ok(
    blurayDifferentGroup.sourceRank > webdlSameGroup.sourceRank,
    "source family must outrank a matching release-group label",
  );
});

test("a compatible BluRay subtitle remains preferred for a REMUX stream", () => {
  const bluray = releaseAffinity(bluray4k, "Movie.2024.2160p.BluRay-HDS");
  const webdl = releaseAffinity(bluray4k, "Movie.2024.2160p.WEB-DL-FraMeSToR");

  assert.equal(bluray.sourceRank, 2);
  assert.equal(webdl.sourceRank, 1);
});

test("a WEB-DL subtitle remains visible but is not eligible for automatic BluRay matching", () => {
  const fallback = releaseAffinity(bluray4k, "Movie.2024.2160p.WEB-DL-FraMeSToR");

  assert.equal(fallback.sourceRank, 1);
  assert.equal(fallback.confidence, "incompatible");
});

test("episode matching rejects a subtitle for another episode", () => {
  const stream = parseRelease("Show.S01E02.1080p.WEB-DL-FLUX");
  const correct = releaseAffinity(stream, "Show.S01E02.1080p.WEB-DL-FLUX");
  const wrong = releaseAffinity(stream, "Show.S01E03.1080p.WEB-DL-FLUX");

  assert.equal(correct.confidence, "high");
  assert.equal(wrong.confidence, "incompatible");
  assert.ok(correct.score > wrong.score);
});

test("an episode contained in a subtitle pack remains compatible", () => {
  const stream = parseRelease("Show.S01E02.1080p.WEB-DL-FLUX");
  const pack = releaseAffinity(stream, "Show.S01E01-E03.1080p.WEB-DL-FLUX");

  assert.notEqual(pack.confidence, "incompatible");
  assert.match(pack.reasons.join(" "), /S1E2 matches/);
});
