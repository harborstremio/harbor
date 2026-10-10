// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  applyMalEpisodeTitles,
  episodesMissingTitle,
  type MalEpisodeTitle,
} from "../src/lib/providers/episode-placeholder.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

function episode(overrides: Partial<KitsuEpisode> = {}): KitsuEpisode {
  return {
    id: 1,
    number: 1,
    seasonNumber: 1,
    title: "Episode 1",
    synopsis: "",
    thumbnail: null,
    airdate: "2026-10-02",
    length: 24,
    ...overrides,
  };
}

const mal: MalEpisodeTitle[] = [
  { number: 1, title: "Mobile Capital Blutgang Has Appeared!", romaji: "Kidou Outo Blutgang ga Arawareta!" },
  { number: 2, title: "A Rampant Scorpius Appeared!", romaji: "Bousou suru Scorpius ga Arawareta!" },
  { number: 3, romaji: "Only Romaji Here" },
];

test("episodesMissingTitle detects only placeholder or empty titles", () => {
  assert.equal(episodesMissingTitle([episode({ title: "Episode 2" })]), true);
  assert.equal(episodesMissingTitle([episode({ title: "" })]), true);
  assert.equal(episodesMissingTitle([episode({ title: "TBA" })]), true);
  assert.equal(episodesMissingTitle([episode({ title: "A Rampant Scorpius Appeared!" })]), false);
});

test("MAL fills a generic episode title with the English name", () => {
  const eps = [episode({ number: 2, title: "Episode 2" })];
  applyMalEpisodeTitles(eps, mal);
  assert.equal(eps[0].title, "A Rampant Scorpius Appeared!");
});

test("MAL never overrides a title another provider already set", () => {
  const eps = [episode({ number: 2, title: "A Real Title" })];
  applyMalEpisodeTitles(eps, mal);
  assert.equal(eps[0].title, "A Real Title");
});

test("MAL does not use a romaji name in place of English", () => {
  const eps = [episode({ number: 3, title: "Episode 3" })];
  applyMalEpisodeTitles(eps, mal);
  assert.equal(eps[0].title, "Episode 3");
});

test("MAL leaves rows it has no record for untouched", () => {
  const eps = [episode({ number: 9, title: "Episode 9" })];
  applyMalEpisodeTitles(eps, mal);
  assert.equal(eps[0].title, "Episode 9");
});

test("the MAL provider reads the Tenrai (Jikan-schema) endpoint", () => {
  const src = readFileSync(new URL("../src/lib/providers/mal-episodes.ts", import.meta.url), "utf8");
  assert.ok(src.includes("api.tenrai.org/v1"));
  assert.ok(src.includes("/anime/${malId}/episodes"));
});
