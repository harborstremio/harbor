// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { mergeCinemetaEpisodes } from "../src/lib/providers/anime-episode-cinemeta-merge.ts";
import type { KitsuEpisode } from "../src/lib/providers/kitsu.ts";

test("fills a generic anime episode title from Cinemeta without overwriting valid metadata", () => {
  const episodes: KitsuEpisode[] = [
    {
      id: 7,
      number: 7,
      seasonNumber: 1,
      title: "Episode 7",
      synopsis: "",
      thumbnail: null,
      airdate: null,
      length: null,
    },
    {
      id: 8,
      number: 8,
      seasonNumber: 1,
      title: "Existing title",
      synopsis: "Existing synopsis",
      thumbnail: "https://example.test/existing.jpg",
      airdate: null,
      length: null,
    },
  ];

  mergeCinemetaEpisodes(episodes, [
    {
      season: 1,
      episode: 7,
      name: "Golden Raana Farming",
      overview: "Episode seven overview",
      thumbnail: "https://example.test/7.jpg",
    },
    {
      season: 1,
      episode: 8,
      name: "Replacement title",
      overview: "Replacement synopsis",
      thumbnail: "https://example.test/8.jpg",
    },
  ]);

  assert.equal(episodes[0].title, "Golden Raana Farming");
  assert.equal(episodes[0].synopsis, "Episode seven overview");
  assert.equal(episodes[0].thumbnail, "https://example.test/7.jpg");
  assert.equal(episodes[1].title, "Existing title");
  assert.equal(episodes[1].synopsis, "Existing synopsis");
  assert.equal(episodes[1].thumbnail, "https://example.test/existing.jpg");
});
