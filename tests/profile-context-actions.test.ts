// @ts-expect-error Node test types.
import assert from "node:assert/strict";
// @ts-expect-error Node test types.
import test from "node:test";
import {
  appendProfileFavorite,
  readOwnFavoriteSnapshot,
} from "../src/lib/profile-favorite-actions";

const game = {
  kind: "game" as const,
  id: "game:1",
  name: "Example",
  image: null,
  sub: null,
  url: null,
  source: "igdb",
};
test("adding a profile game preserves other kinds and existing memberships", () => {
  const previous = {
    game: [],
    book: [{ ...game, kind: "book" as const, id: "book:1" }],
    music: [],
  };
  const next = appendProfileFavorite(previous, game, 12);
  assert.equal(previous.game.length, 0);
  assert.deepEqual(next.book, previous.book);
  assert.deepEqual(next.game, [game]);
});
test("existing game at capacity is idempotent and unrelated full list rejects an addition", () => {
  const full = { game: [game], book: [], music: [] };
  assert.equal(appendProfileFavorite(full, game, 1), full);
  assert.throws(() => appendProfileFavorite(full, { ...game, id: "game:2" }, 1));
});

test("owner snapshots preserve untouched metadata and reject malformed lists without empty normalization", () => {
  const book = { ...game, kind: "book", id: "book:1", customMetadata: { rating: 5 } };
  const owner = { handle: "owner", isOwner: true, favorites: { game: [], book: [book] } };
  const parsed = readOwnFavoriteSnapshot(owner, "owner");
  const added = appendProfileFavorite(parsed, game, 12);
  assert.deepEqual(added.book, [book]);
  assert.deepEqual(added.music, []);
  for (const favorites of [
    { book: null },
    { game: "invalid" },
    { music: [{}] },
    { book: [game] },
    { game: [game, game] },
    { future: [] },
  ])
    assert.throws(() => readOwnFavoriteSnapshot({ ...owner, favorites }, "owner"), /safely/);
  assert.throws(() => readOwnFavoriteSnapshot({ ...owner, isOwner: false }, "owner"), /confirm/);
  assert.throws(() => readOwnFavoriteSnapshot(owner, "another"), /confirm/);
  assert.deepEqual(readOwnFavoriteSnapshot({ handle: "owner", isOwner: true }, "owner"), {
    game: [],
    book: [],
    music: [],
  });
});
