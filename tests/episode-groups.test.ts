import assert from "node:assert/strict";
import test from "node:test";
import {
  groupEpisodes,
  NO_SEASON,
  type CinemetaVideo,
} from "../src/views/detail/episode-groups.ts";

const v = (
  season: number | null,
  episode: number | null,
  name: string,
  released?: string,
): CinemetaVideo => ({ season: season ?? undefined, episode: episode ?? undefined, name, released });

const seasons = (groups: ReturnType<typeof groupEpisodes>) =>
  groups.map((g) => g.seasonNumber);
const names = (groups: ReturnType<typeof groupEpisodes>, season: number) =>
  groups.find((g) => g.seasonNumber === season)?.episodes.map((e) => e.name);

test("seasons keep their own order and the episodes inside them are sorted", () => {
  const groups = groupEpisodes([v(2, 2, "b"), v(1, 2, "d"), v(2, 1, "a"), v(1, 1, "c")]);
  assert.deepEqual(seasons(groups), [1, 2]);
  assert.deepEqual(names(groups, 1), ["c", "d"]);
  assert.deepEqual(names(groups, 2), ["a", "b"]);
});

test("a provider's unnumbered episodes get their own group after the seasons", () => {
  // The real shape: season 2 is numbered, and the bonus episodes carry no season at all.
  const groups = groupEpisodes([
    v(2, 1, "Episode 1"),
    v(2, 2, "Episode 2"),
    v(null, 1, "Episode 1 Bonus"),
    v(null, 2, "Episode 2 Bonus"),
  ]);
  assert.deepEqual(seasons(groups), [2, NO_SEASON]);
  assert.deepEqual(names(groups, NO_SEASON), ["Episode 1 Bonus", "Episode 2 Bonus"]);
  // They are a group of their own, not a second copy of season 2.
  assert.deepEqual(names(groups, 2), ["Episode 1", "Episode 2"]);
});

test("a provider that numbers nothing gives one group, as it always did", () => {
  const groups = groupEpisodes([v(null, 1, "One"), v(null, 2, "Two")]);
  assert.deepEqual(seasons(groups), [NO_SEASON]);
  assert.deepEqual(names(groups, NO_SEASON), ["One", "Two"]);
});

test("the unnumbered group keeps the provider's order, because a row is addressed by position", () => {
  // These have no numbers, so the position in this list is the only address a row has. Sorting it
  // would make that position name a different episode than the one the player is asked for.
  const groups = groupEpisodes([
    v(null, 1, "first", "2024-05-01"),
    v(null, 2, "second", "2024-01-01"),
  ]);
  assert.deepEqual(names(groups, NO_SEASON), ["first", "second"]);
});

test("nothing in gives nothing out", () => {
  assert.deepEqual(groupEpisodes([]), []);
});

test("an episode with a season but no number still lands in the unnumbered group", () => {
  // It cannot be addressed by number either way, so it belongs with the episodes that cannot be.
  const groups = groupEpisodes([v(2, 1, "Numbered"), v(2, null, "Unnumbered")]);
  assert.deepEqual(seasons(groups), [2, NO_SEASON]);
  assert.deepEqual(names(groups, NO_SEASON), ["Unnumbered"]);
});
