// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  applyTmdbEpisodeNames,
  needsTmdbEpisodeNames,
  pickEpisodeName,
  type TmdbEpisodeText,
} from "../src/lib/providers/tmdb/tmdb-episode-name-merge.ts";

const tmdb = (name: string, overview = "", still?: string): TmdbEpisodeText => ({
  name,
  overview,
  still,
});

test("a generic addon title loses to the real tmdb title", () => {
  assert.equal(pickEpisodeName("Episode 5", "The Rains of Castamere"), "The Rains of Castamere");
  assert.equal(pickEpisodeName("Épisode 12", "Winter Is Coming"), "Winter Is Coming");
  assert.equal(pickEpisodeName("第18話", "Blood Moon"), "Blood Moon");
  assert.equal(pickEpisodeName("", "Blood Moon"), "Blood Moon");
  assert.equal(pickEpisodeName(undefined, "Blood Moon"), "Blood Moon");
});

test("a real addon title is never overwritten by tmdb", () => {
  assert.equal(pickEpisodeName("Ozymandias", "Ozymandias (TMDB)"), "Ozymandias");
  assert.equal(pickEpisodeName("Ozymandias", undefined), "Ozymandias");
});

test("a generic tmdb title never replaces anything", () => {
  assert.equal(pickEpisodeName("Ozymandias", "Episode 14"), "Ozymandias");
  assert.equal(pickEpisodeName("Episode 14", "Episode 14"), "Episode 14");
  assert.equal(pickEpisodeName(undefined, "Episode 14"), undefined);
});

test("a season is only sent to tmdb when a title is missing or generic", () => {
  assert.equal(needsTmdbEpisodeNames([{ episode: 1, name: "Pilot" }]), false);
  assert.equal(needsTmdbEpisodeNames([{ episode: 1, name: "Pilot" }, { episode: 2 }]), true);
  assert.equal(needsTmdbEpisodeNames([{ episode: 1, name: "Episode 1" }]), true);
  assert.equal(needsTmdbEpisodeNames([{ episode: 1, name: "   " }]), true);
});

test("the overlay fills generic titles and leaves real ones alone", () => {
  const eps = [
    { episode: 1, name: "Pilot", overview: "A real synopsis." },
    { episode: 2, name: "Episode 2" },
    { episode: 3, name: "Episode 3" },
  ];
  const names = new Map([
    [1, tmdb("Pilot (TMDB)", "Another synopsis.")],
    [2, tmdb("Cat's in the Bag...", "Jesse disposes of the bodies.", "https://img/w300/a.jpg")],
  ]);
  const out = applyTmdbEpisodeNames(eps, names);
  assert.notEqual(out, eps);
  assert.equal(out[0].name, "Pilot");
  assert.equal(out[0].overview, "A real synopsis.");
  assert.equal(out[1].name, "Cat's in the Bag...");
  assert.equal(out[1].overview, "Jesse disposes of the bodies.");
  assert.equal(out[1].still, "https://img/w300/a.jpg");
  assert.equal(out[2].name, "Episode 3");
});

test("the overlay returns the same array when it changes nothing", () => {
  const eps = [{ episode: 1, name: "Pilot", overview: "Real." }];
  assert.equal(applyTmdbEpisodeNames(eps, new Map()), eps);
  assert.equal(applyTmdbEpisodeNames(eps, new Map([[1, tmdb("Pilot (TMDB)", "Other.")]])), eps);
  assert.equal(applyTmdbEpisodeNames(eps, new Map([[9, tmdb("Elsewhere")]])), eps);
});

test("an addon still is never replaced by the tmdb still", () => {
  const eps = [{ episode: 1, name: "Episode 1", still: "https://addon/still.jpg" }];
  const out = applyTmdbEpisodeNames(eps, new Map([[1, tmdb("Pilot", "", "https://img/w300/a.jpg")]]));
  assert.equal(out[0].name, "Pilot");
  assert.equal(out[0].still, "https://addon/still.jpg");
});
