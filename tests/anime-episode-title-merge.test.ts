// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  buildKitsuEpisodes,
  mergeAniZipEpisodes,
  mergeTvdbEpisodes,
} from "../src/lib/providers/anime-episode-build.ts";
import { mergeCinemetaEpisodes } from "../src/lib/providers/anime-episode-cinemeta-merge.ts";

function episode(title: string) {
  return {
    id: 1,
    number: 1,
    seasonNumber: 1,
    title,
    synopsis: "",
    thumbnail: null,
    airdate: null,
    length: null,
  };
}

test("a generic addon title does not hide a real Kitsu title", () => {
  const built = buildKitsuEpisodes(
    { videos: [{ id: "kitsu:50350:1", season: 1, episode: 1, title: "Episode 1" }] },
    [episode("An Encounter")],
  );
  assert.equal(built[0].title, "An Encounter");
});

test("AniZip replaces normalized and unnumbered placeholders but not real episode titles", () => {
  const normalized = episode(" episode 01 ");
  const unnumbered = episode("TBA");
  const real = episode("Episode 1: The Beginning");
  const mapping = {
    episodes: { "1": { episodeNumber: 1, title: { en: "An Encounter" } } },
  };
  mergeAniZipEpisodes([normalized], mapping);
  mergeAniZipEpisodes([unnumbered], mapping);
  mergeAniZipEpisodes([real], mapping);
  assert.equal(normalized.title, "An Encounter");
  assert.equal(unnumbered.title, "An Encounter");
  assert.equal(real.title, "Episode 1: The Beginning");
});

test("TVDB uses the same placeholder rule", () => {
  const generic = episode("EPISODE 1");
  const real = episode("Pilot");
  const tvdb = [{ id: 10, seasonNumber: 1, number: 1, name: "An Encounter" }];
  mergeTvdbEpisodes([generic], tvdb);
  mergeTvdbEpisodes([real], tvdb);
  assert.equal(generic.title, "An Encounter");
  assert.equal(real.title, "Pilot");
});

test("later providers never overwrite an earlier real title", () => {
  const resolved = episode("Episode 1");
  mergeAniZipEpisodes([resolved], {
    episodes: { "1": { episodeNumber: 1, title: { en: "An Encounter" } } },
  });
  mergeTvdbEpisodes([resolved], [
    { id: 10, seasonNumber: 1, number: 1, name: "Different TVDB title" },
  ]);
  mergeCinemetaEpisodes([resolved], [
    { season: 1, episode: 1, name: "Different Cinemeta title" },
  ]);
  assert.equal(resolved.title, "An Encounter");
});
