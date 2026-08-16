// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { pickEpisodeTitle } from "../src/lib/providers/anizip-episode-title.ts";

test("reads the singular title object used by the live AniZip schema", () => {
  assert.equal(
    pickEpisodeTitle({ episodeNumber: 1, title: { en: "An Encounter", ja: "出会い" } }),
    "An Encounter",
  );
});

test("retains compatibility with the legacy plural titles object", () => {
  assert.equal(
    pickEpisodeTitle({ episodeNumber: 1, titles: { "x-jat": "Deai", ja: "出会い" } }),
    "Deai",
  );
});

test("ignores blank values and falls back across schemas and languages", () => {
  assert.equal(
    pickEpisodeTitle({
      episodeNumber: 1,
      title: { en: " ", "x-jat": "" },
      titles: { en: "", ja: " 出会い " },
    }),
    "出会い",
  );
  assert.equal(pickEpisodeTitle({ episodeNumber: 1, title: { en: "" } }), null);
  assert.equal(pickEpisodeTitle(undefined), null);
});

test("does not let an English placeholder hide a real alternate-language title", () => {
  assert.equal(
    pickEpisodeTitle({
      episodeNumber: 1,
      title: { en: "Episode 1", ja: "出会い" },
    }),
    "出会い",
  );
  assert.equal(
    pickEpisodeTitle({ episodeNumber: 1, title: { en: "Episode 1" } }),
    null,
  );
});
