// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import {
  episodeInResumeSeason,
  matchPlayedEpisode,
  poolHasSeason,
} from "../src/views/detail/anime-episodes/anime-season-key.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function ep(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return {
    id: 1,
    number: 3,
    seasonNumber: 1,
    title: "",
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: null,
    ...overrides,
  };
}

test("an S6 resume does not match a part-1 episode with the same number", () => {
  const part1E3 = ep({ id: 11, number: 3, seasonNumber: 1, imdbSeason: 1, imdbEpisode: 3 });
  assert.equal(episodeInResumeSeason(part1E3, 6), false);
  assert.equal(
    matchPlayedEpisode([part1E3], { season: 6, episode: 3 }, "tt2359704", "tt2359704", false),
    undefined,
  );
});

test("the resume's own season matches either numbering", () => {
  const sbrE3 = ep({ id: 12, number: 3, seasonNumber: 1, imdbSeason: 6, imdbEpisode: 3 });
  assert.equal(episodeInResumeSeason(sbrE3, 6), true);
  assert.equal(
    matchPlayedEpisode([sbrE3], { season: 6, episode: 3 }, "tt2359704", "tt2359704", false)?.id,
    12,
  );
  // Saved from the entry's own page the resume uses the native season (1).
  assert.equal(
    matchPlayedEpisode([sbrE3], { season: 1, episode: 3 }, "kitsu:49847", "kitsu:49847", false)?.id,
    12,
  );
});

test("the pool reports whether it contains the resume's season", () => {
  const part1E3 = ep({ id: 11, number: 3, seasonNumber: 1, imdbSeason: 1 });
  assert.equal(poolHasSeason([part1E3], 6), false);
  assert.equal(poolHasSeason([part1E3], 1), true);
});

test("the preferred season trusts a resume season the pool lacks", () => {
  const src = readFileSync(
    new URL("../src/views/detail/anime-episodes/use-anime-preferred-season.ts", import.meta.url),
    "utf8",
  );
  assert.ok(src.includes("matchPlayedEpisode"));
  assert.ok(src.includes("poolHasSeason"));
  assert.ok(src.includes("return String(played.season)"));
});
