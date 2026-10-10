import assert from "node:assert/strict";
import test from "node:test";
import { mergeCatalogContinuation, missingSearchCursor } from "../src/lib/games/catalog-recovery.ts";
import type { UnifiedGameSearchPage } from "../src/lib/games/unified-game-search.ts";

const game = (id: string) => ({ id, name: id, capsule: "", platforms: [] });
const previous: UnifiedGameSearchPage = {
  games: [game("igdb:1"), game("igdb:2")], total: 2, nextOffset: 60,
  searchCursor: { steam: 30, igdb: 60 }, unavailable: ["Steam"],
};

test("partial recovery retries only the unavailable provider at its failed offset", () => {
  assert.deepEqual(missingSearchCursor(previous), { steam: 30, igdb: null });
  assert.equal(missingSearchCursor({ ...previous, unavailable: [] }), null);
  assert.equal(missingSearchCursor({ games: [], total: 0, nextOffset: 30 }), null);
});

test("recovering one provider preserves accumulated matches and the healthy cursor", () => {
  const result = mergeCatalogContinuation("", "_ASC", previous, {
    games: [game("igdb:3")], total: 1, nextOffset: null,
    searchCursor: { steam: null, igdb: null }, unavailable: [],
  }, { steam: 30, igdb: null }, true);
  assert.deepEqual(result.games.map(game => game.id), ["igdb:1", "igdb:2", "igdb:3"]);
  assert.deepEqual(result.searchCursor, { steam: null, igdb: 60 });
  assert.equal(result.nextOffset, 60);
  assert.equal(result.total, 3);
  assert.deepEqual(result.unavailable, []);
});

test("a still-failed provider does not advance or erase a healthy provider", () => {
  const result = mergeCatalogContinuation("", "_ASC", previous, {
    games: [], total: 0, nextOffset: 30,
    searchCursor: { steam: 30, igdb: null }, unavailable: ["Steam"],
  }, { steam: 30, igdb: null }, true);
  assert.deepEqual(result.searchCursor, previous.searchCursor);
  assert.deepEqual(result.games, previous.games);
  assert.deepEqual(result.unavailable, ["Steam"]);
});

test("ordinary continuation advances both providers and merges stable identities", () => {
  const result = mergeCatalogContinuation("", "_ASC", previous, {
    games: [game("igdb:2"), game("igdb:3")], total: 2, nextOffset: 90,
    searchCursor: { steam: 60, igdb: 90 }, unavailable: [],
  }, { steam: 30, igdb: 60 }, false);
  assert.equal(result.games.length, 3);
  assert.deepEqual(result.searchCursor, { steam: 60, igdb: 90 });
  assert.deepEqual(result.unavailable, []);
});

test("Steam-only continuation retains its provider total and saved-data provenance", () => {
  const result = mergeCatalogContinuation("", "_ASC", {
    games: [game("steam:1")], total: 300, nextOffset: 30, cachedAt: 100,
  }, { games: [game("steam:1"), game("steam:2")], total: 299, nextOffset: 60 },
  { steam: 30, igdb: 30 }, false);
  assert.equal(result.total, 299);
  assert.equal(result.nextOffset, 60);
  assert.equal(result.games.length, 2);
  assert.equal(result.cachedAt, 100);
});

test("same-title distinct editions stay distinct during provider recovery", () => {
  const result = mergeCatalogContinuation("Resident Evil", "_ASC", {
    ...previous, games: [{ ...game("igdb:1"), name: "Resident Evil" }],
  }, { games: [{ ...game("igdb:2"), name: "Resident Evil" }], total: 1, nextOffset: null,
    searchCursor: { steam: null, igdb: null } }, { steam: 30, igdb: null }, true);
  assert.equal(result.games.length, 2);
});
