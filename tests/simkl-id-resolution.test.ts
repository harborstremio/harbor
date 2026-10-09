// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { resolveSimklEpisodeTarget } from "../src/lib/simkl/ids.ts";

test("Simkl watched fallback resolves direct MAL episodes", async () => {
  assert.deepEqual(await resolveSimklEpisodeTarget("mal:21", { season: 1, episode: 7 }), {
    kind: "anime-episode",
    anime: { ids: { mal: 21 } },
    season: 1,
    number: 7,
  });
});

test("Simkl watched fallback prefers a verified IMDb episode identity", async () => {
  assert.deepEqual(
    await resolveSimklEpisodeTarget(
      "kitsu:1",
      { season: 1, episode: 14, imdbSeason: 2, imdbEpisode: 3 },
      "tt1234567",
    ),
    {
      kind: "episode",
      show: { ids: { imdb: "tt1234567" } },
      season: 2,
      number: 3,
    },
  );
});
