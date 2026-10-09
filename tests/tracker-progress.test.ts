// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { animeTrackerTarget } from "../src/lib/tracker-progress.ts";

test("native entry rows use entry-relative numbers, regardless of provider or absolute coordinates", () => {
  const episode = { season: 1, episode: 1, imdbSeason: 3, imdbEpisode: 13, absoluteNumber: 50 };
  assert.deepEqual(animeTrackerTarget("kitsu:45619", episode, 1), { id: "kitsu:45619", episode: 1 });
  assert.deepEqual(animeTrackerTarget("mal:123", episode, 1), { id: "mal:123", episode: 1 });
  assert.deepEqual(animeTrackerTarget("anilist:123", episode, 1), { id: "anilist:123", episode: 1 });
});

test("an explicit cour source owns its own number, never the parent's stream number", () => {
  const episode = { season: 1, episode: 1, sourceMetaId: "kitsu:45619", kitsuStreamId: "kitsu:45398:13" };
  assert.deepEqual(animeTrackerTarget("kitsu:45398", episode, 1), { id: "kitsu:45619", episode: 1 });
});

test("a scoped stream binds long-running episode numbers to the correct entry", () => {
  const episode = { season: 21, episode: 45, kitsuStreamId: "kitsu:12:1089" };
  assert.deepEqual(animeTrackerTarget("tt0388629", episode, 45), { id: "kitsu:12", episode: 1089 });
  assert.deepEqual(animeTrackerTarget("kitsu:99", episode, 45), { id: "kitsu:12", episode: 1089 });
});

test("non-anime and malformed IDs never invent a tracker entry", () => {
  assert.equal(animeTrackerTarget("tt10", { season: 1, episode: 1 }, 1), null);
  assert.equal(animeTrackerTarget("kitsu:bad", undefined, 1), null);
  assert.equal(animeTrackerTarget("tt10", { season: 1, episode: 1, kitsuStreamId: "kitsu:12:1:bad" }, 1), null);
});
