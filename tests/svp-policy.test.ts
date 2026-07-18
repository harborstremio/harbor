// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isAnimeMedia, isSvpActiveForMedia } from "../src/lib/player/svp-policy.ts";

const baseSettings = {
  playerSvp: true,
  svpVpyPath: "C:/svp/script.vpy",
  svpScope: "all" as const,
};

test("detects anime metadata from providers and genres", () => {
  assert.equal(isAnimeMedia({ id: "kitsu:1" }), true);
  assert.equal(isAnimeMedia({ id: "tt123", genres: ["Animation"] }), true);
  assert.equal(isAnimeMedia({ id: "tt456", genres: ["Drama"] }), false);
});

test("applies SVP only when the configured scope matches the media", () => {
  const anime = { id: "kitsu:1" };
  const movie = { id: "tt456", genres: ["Drama"] };

  assert.equal(isSvpActiveForMedia(baseSettings, anime), true);
  assert.equal(isSvpActiveForMedia({ ...baseSettings, svpScope: "anime" }, anime), true);
  assert.equal(isSvpActiveForMedia({ ...baseSettings, svpScope: "anime" }, movie), false);
  assert.equal(isSvpActiveForMedia({ ...baseSettings, svpScope: "non-anime" }, anime), false);
  assert.equal(isSvpActiveForMedia({ ...baseSettings, svpScope: "non-anime" }, movie), true);
});

test("requires both SVP enablement and a VapourSynth script", () => {
  const media = { id: "tt456" };
  assert.equal(isSvpActiveForMedia({ ...baseSettings, playerSvp: false }, media), false);
  assert.equal(isSvpActiveForMedia({ ...baseSettings, svpVpyPath: "" }, media), false);
});
