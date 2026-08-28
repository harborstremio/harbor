// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { subtitleReleaseLabel } from "../src/lib/subtitles/release-label.ts";

test("formats a BluRay REMUX release without repeating the movie title", () => {
  assert.equal(
    subtitleReleaseLabel("Spider-Man.No.Way.Home.2022.REMUX.1080p.BluRay.DTS-HD.MA"),
    "BluRay REMUX · 1080p · DTS-HD MA",
  );
});

test("keeps useful WEB-DL, HDR, and video codec details", () => {
  assert.equal(
    subtitleReleaseLabel("Movie.2024.2160p.WEB-DL.DV.HDR.HEVC"),
    "WEB-DL · 2160p · Dolby Vision · HDR · HEVC",
  );
});

test("keeps both video and audio details when a release supplies them", () => {
  assert.equal(
    subtitleReleaseLabel("Movie.2024.1080p.BluRay.x264.DTS-NOGRP"),
    "BluRay · 1080p · x264 · DTS",
  );
});

test("does not turn an unknown release into a misleading label", () => {
  assert.equal(subtitleReleaseLabel("A provider supplied title"), undefined);
});
