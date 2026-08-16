// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { mergeCinemetaEpisodes } from "../src/lib/providers/anime-episode-cinemeta-merge.ts";

function episode(number: number, title: string) {
  return {
    id: number,
    number,
    seasonNumber: 1,
    title,
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: null,
  };
}

test("Cinemeta is a fallback for generic titles and missing episode metadata", () => {
  const generic = episode(1, "Episode 01");
  const real = episode(2, "Pilot");
  mergeCinemetaEpisodes([generic, real], [
    {
      season: 1,
      episode: 1,
      name: "An Encounter",
      overview: "Episode one overview",
      thumbnail: "https://example.test/1.jpg",
    },
    { season: 1, episode: 2, title: "Replacement title" },
  ]);
  assert.equal(generic.title, "An Encounter");
  assert.equal(generic.synopsis, "Episode one overview");
  assert.equal(generic.thumbnail, "https://example.test/1.jpg");
  assert.equal(real.title, "Pilot");
});

test("Cinemeta skips a generic name when its title field is real", () => {
  const generic = episode(1, "Episode 1");
  mergeCinemetaEpisodes([generic], [
    { season: 1, episode: 1, name: "Episode 1", title: "An Encounter" },
  ]);
  assert.equal(generic.title, "An Encounter");
});
