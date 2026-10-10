import assert from "node:assert/strict";
import test from "node:test";
import { toggleLibrarySelection } from "../src/lib/games/library-selection.ts";
import { changeCustomLibrary, customLibraryKey, emptyCustomLibrary, readCustomLibrary, updateCustomGames, type CustomGame } from "../src/lib/games/custom-library.ts";
import { addCollectionGames, changePersonalCollections, createPersonalCollection, emptyPersonalCollections, personalCollectionsKey, readPersonalCollections } from "../src/lib/games/personal-collections.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const game = (n: number): CustomGame => ({ id: id(n), name: `Game ${n}`, config: { executable: `W:/Games/${n}/game.exe`, workingDirectory: null, arguments: ["--windowed"], mode: "native", runner: null, prefix: null, steamDirectory: null }, linked: null, artwork: "W:/Art/cover.png", pinned: false, hidden: false, addedAt: 1, lastPlayed: 123, measuredSeconds: 90 });
const summary = (n: number) => ({ id: `steam:${n}`, steamId: n, name: `Game ${n}`, capsule: "", platforms: [] });

test("range selection uses displayed order in either direction and drops filtered identities", () => {
  const order = ["d", "b", "a", "c"];
  assert.deepEqual(toggleLibrarySelection(["hidden", "c"], order, "a", "d", true), ["c", "d", "b", "a"]);
  assert.deepEqual(toggleLibrarySelection(["c"], order, "b", "c", true), ["c", "b", "a"]);
  assert.deepEqual(toggleLibrarySelection(["a"], order, "a", null, false), []);
  assert.deepEqual(toggleLibrarySelection([], order, "a", "missing", true), ["a"]);
  assert.deepEqual(toggleLibrarySelection(["a"], order, "unknown", null, false), ["a"]);
});

test("bulk presentation changes preserve launch settings, artwork, history and unselected games", () => {
  const store = { ...emptyCustomLibrary(), games: [game(1), game(2), game(3)], sessions: [{ id: id(7), gameId: id(1), startedAt: 1, endedAt: 91, seconds: 90, success: true, code: 0 }] };
  const result = updateCustomGames(store, [id(1), id(2), id(1)], { pinned: true, hidden: true });
  assert.deepEqual(result.games.map(g => g.pinned), [true, true, false]);
  assert.deepEqual(result.games.map(g => g.hidden), [true, true, false]);
  assert.deepEqual(result.sessions, store.sessions);
  for (const g of result.games) { assert.deepEqual(g.config, store.games[0].id === g.id ? store.games[0].config : store.games.find(item => item.id === g.id)!.config); assert.equal(g.artwork, "W:/Art/cover.png"); assert.equal(g.measuredSeconds, 90); }
  assert.equal(store.games[0].hidden, false);
  assert.throws(() => updateCustomGames(store, [id(1), id(99)], { hidden: true }), /removed/);
});

test("batch collection membership reconciles identities, stays unique and never mutates the input", () => {
  const store = createPersonalCollection(emptyPersonalCollections(), "Weekend", "one");
  const result = addCollectionGames(store, "one", [summary(1), summary(1), summary(2)]);
  assert.deepEqual(result.collections[0].gameIds, ["steam:2", "steam:1"]);
  assert.equal(store.collections[0].gameIds.length, 0);
  assert.throws(() => addCollectionGames(store, "one", [summary(1), { ...summary(0), steamId: undefined }]), /game/);
  assert.equal(store.collections[0].gameIds.length, 0);
});

test("failed batch writes and removed entries leave the complete original library intact", async () => {
  const memory = new Map<string, string>(); let denied = false;
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { if (denied) throw Error("QuotaExceededError"); memory.set(key, value); } } as Storage;
  memory.set(customLibraryKey("main"), JSON.stringify({ ...emptyCustomLibrary(), games: [game(1), game(2)] }));
  memory.set(personalCollectionsKey("main"), JSON.stringify(createPersonalCollection(emptyPersonalCollections(), "Weekend", "one")));
  denied = true;
  await assert.rejects(changeCustomLibrary("main", s => updateCustomGames(s, [id(1), id(2)], { pinned: true })));
  await assert.rejects(changePersonalCollections("main", s => addCollectionGames(s, "one", [summary(1), summary(2)])));
  assert.ok(readCustomLibrary("main").games.every(g => !g.pinned));
  assert.equal(readPersonalCollections("main").collections[0].gameIds.length, 0);
  denied = false;
  await assert.rejects(changeCustomLibrary("main", s => updateCustomGames(s, [id(1), id(99)], { hidden: true })));
  await changeCustomLibrary("main", s => updateCustomGames(s, [id(1), id(2)], { pinned: true }));
  assert.ok(readCustomLibrary("main").games.every(g => g.pinned));
  assert.equal(readCustomLibrary("other").games.length, 0);
});
