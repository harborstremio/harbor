import assert from "node:assert/strict";
import test from "node:test";
import { pickEpisodes } from "../src/lib/streams/plugins/extension/match.ts";
import type { BridgeMedia } from "../src/lib/streams/plugins/extension/bridge.ts";
import type { StreamPluginRequest } from "../src/lib/streams/plugins/types.ts";

const media = (episodes: BridgeMedia["episodes"]): BridgeMedia => ({
  name: "India's Got Latent",
  url: "https://p.example/show/",
  type: "tvseries",
  year: 2024,
  playableData: null,
  episodes,
});

const req = (over: Partial<StreamPluginRequest> = {}): StreamPluginRequest => ({
  type: "series",
  id: "capstan:ext/p:https%3A%2F%2Fp.example%2Fshow%2F",
  ids: [],
  imdbId: null,
  tmdb: null,
  title: "India's Got Latent",
  year: 2024,
  season: 2,
  episode: 1,
  absoluteEpisode: null,
  settings: {},
  ...over,
});

const ep = (data: string, season: number | null, episode: number | null, name: string) => ({
  data,
  name,
  season,
  episode,
  track: "",
});

// The real shape: season 2 is numbered, and the bonus episodes carry no season at all -- which is
// what CloudStream shows under "No Season".
const withBonus = media([
  ep("s2e1", 2, 1, "Episode 1"),
  ep("s2e2", 2, 2, "Episode 2"),
  ep("bonus1", null, 1, "Episode 1 Bonus"),
  ep("bonus2", null, 2, "Episode 2 Bonus"),
]);

test("an episode carrying no season no longer answers for a numbered one", () => {
  assert.deepEqual(pickEpisodes(withBonus, req({ season: 2, episode: 1 })), ["s2e1"]);
  assert.deepEqual(pickEpisodes(withBonus, req({ season: 2, episode: 2 })), ["s2e2"]);
});

test("a provider that numbers nothing at all is still reached", () => {
  const unnumbered = media([ep("a", null, 1, "One"), ep("b", null, 2, "Two")]);
  assert.deepEqual(pickEpisodes(unnumbered, req({ season: 2, episode: 1 })), ["a"]);
  // Including when the season asked for is one the provider never mentions.
  assert.deepEqual(pickEpisodes(unnumbered, req({ season: 9, episode: 2 })), ["b"]);
});

test("a season that is missing its own numbering still falls back rather than going empty", () => {
  // The provider numbers season 1 but leaves season 2's episodes without a season.
  const partial = media([
    ep("s1e1", 1, 1, "Episode 1"),
    ep("s2e1", null, 1, "Episode 1"),
  ]);
  assert.deepEqual(pickEpisodes(partial, req({ season: 2, episode: 1 })), ["s2e1"]);
  assert.deepEqual(pickEpisodes(partial, req({ season: 1, episode: 1 })), ["s1e1"]);
});

test("an absolute number is still honoured when no season is named", () => {
  const anime = media([ep("a", null, 1, ""), ep("b", null, 2, "")]);
  assert.deepEqual(pickEpisodes(anime, req({ season: null, episode: null, absoluteEpisode: 2 })), [
    "b",
  ]);
});

// The real shape: the provider numbers season 2 but leaves its bonus episodes unnumbered, and the
// list hands each of those a position instead. Sending that position back is the only address they
// have, and without reading it as one the row shows but can never play.
const numberedPlusBonus = media([
  ep("s2e1", 2, 1, "Episode 1"),
  ep("s2e2", 2, 2, "Episode 2"),
  ...Array.from({ length: 20 }, (_, i) => ep(`bonus${i + 1}`, null, null, `Bonus ${i + 1}`)),
]);

test("a No Season row plays by the position the list gave it", () => {
  assert.deepEqual(pickEpisodes(numberedPlusBonus, req({ season: 0, episode: 20 })), ["bonus20"]);
  assert.deepEqual(pickEpisodes(numberedPlusBonus, req({ season: 0, episode: 1 })), ["bonus1"]);
  // The position counts the unnumbered episodes only, so a numbered season cannot shift it.
  assert.deepEqual(pickEpisodes(numberedPlusBonus, req({ season: 2, episode: 1 })), ["s2e1"]);
});

test("a position is never read as one for an episode that has a number of its own", () => {
  // A real season and episode must not be reinterpreted, or a missing episode would silently play
  // whichever episode happens to sit at that position.
  assert.deepEqual(pickEpisodes(numberedPlusBonus, req({ season: 2, episode: 9 })), []);
  assert.deepEqual(pickEpisodes(numberedPlusBonus, req({ season: 1, episode: 20 })), []);
});
