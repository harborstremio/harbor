import assert from "node:assert/strict";
import test from "node:test";
import { launcherIdentityKey, observeLauncherIdentities, parseLauncherIdentities, reconcileLauncherIdentities } from "../src/lib/games/launcher-identities.ts";
import { isLauncherGameId, launcherDispatchId, launcherGameSummary, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { emptyLibraryPreferences, patchLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { quickLibrary } from "../src/lib/games/quick-library.ts";
import { emptyPersonalCollections, createPersonalCollection, addCollectionGame } from "../src/lib/games/personal-collections.ts";

const one = "machine:12345678-90ab-cdef-1234-567890abcdef";
const two = "machine:22345678-90ab-cdef-1234-567890abcdef";
const empty = () => parseLauncherIdentities(null);
const game = (productId: string, installKey: string | undefined = one): LauncherGame => ({ id: `ea:${productId}`, productId, installKey, launcher: "ea", name: "Same title", installPath: "F:/Games/Test", state: "installed", launchMode: "play" });
const scan = (...games: LauncherGame[]): LauncherScan => ({ supported: true, games, clients: [{ launcher: "ea", installed: true }], warnings: [] });

test("EA additions and removals preserve the library ID across reloads while dispatch uses current aliases", () => {
  let identities = empty();
  for (const ids of ["1,A", "1,A,B", "A,B", "B,C"]) {
    const result = reconcileLauncherIdentities(scan(game(ids)), identities);
    assert.equal(result.scan.games[0].id, "ea:1,A");
    assert.equal(launcherDispatchId(result.scan.games[0]), `ea:${ids}`);
    identities = parseLauncherIdentities(JSON.stringify(result.identities));
    assert.equal(identities.entries.length, 1);
  }
});

test("saved entries, collection membership, pins and custom covers keep their existing keys", () => {
  const first = reconcileLauncherIdentities(scan(game("1,A")), empty());
  const saved = launcherGameSummary(first.scan.games[0]);
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), [saved.id], { pinned: true, cover: "F:/Art/custom.png" });
  let collections = createPersonalCollection(emptyPersonalCollections(), "Favorites", "collection", 1);
  collections = addCollectionGame(collections, "collection", saved);
  const next = reconcileLauncherIdentities(scan(game("A,B")), first.identities);
  const retro = { version: 1 as const, folders: [], profiles: {}, lastPlayed: {}, matches: {} };
  const items = quickLibrary([], [], retro, [saved], preferences, next.scan);
  assert.equal(items.length, 1);
  assert.equal(items[0].favorite, true);
  assert.equal(items[0].ready, true);
  assert.equal(preferences.entries[items[0].id].cover, "F:/Art/custom.png");
  assert.equal(collections.collections[0].gameIds[0], items[0].id);
  assert.equal(patchLibraryPreferences(preferences, [items[0].id], { pinned: false }).entries[items[0].id].pinned, false);
});

test("matching names, paths or aliases alone never reconcile different registrations", () => {
  const initial = reconcileLauncherIdentities(scan(game("1,A")), empty());
  for (const next of [game("A,B", two), { ...game("A,B"), installKey: undefined }, game("X,Y")]) {
    assert.equal(reconcileLauncherIdentities(scan(next), initial.identities).scan.games[0].id, next.id);
  }
  const duplicate = reconcileLauncherIdentities(scan(game("1,A"), game("A,B")), initial.identities);
  assert.deepEqual(duplicate.scan.games.map(item => item.id), ["ea:1,A", "ea:A,B"]);
  assert.deepEqual(duplicate.identities, initial.identities);
});

test("a different registration reusing old aliases cannot inherit the absent game's preferences", () => {
  const initial = reconcileLauncherIdentities(scan(game("1,A")), empty());
  const next = reconcileLauncherIdentities(scan(game("1,A", two)), initial.identities);
  assert.notEqual(next.scan.games[0].id, "ea:1,A");
  assert.ok(isLauncherGameId(next.scan.games[0].id));
  assert.equal(launcherDispatchId(next.scan.games[0]), "ea:1,A");
  const again = reconcileLauncherIdentities(scan(game("A,B", two)), next.identities);
  assert.equal(again.scan.games[0].id, next.scan.games[0].id);
});

test("missing, ambiguous and conflicting current identities cannot take over existing entries", () => {
  const initial = reconcileLauncherIdentities(scan(game("1,A")), empty());
  for (const state of ["missing", "incomplete", "ambiguous"] as const) {
    const result = reconcileLauncherIdentities(scan({ ...game("A,B"), state }), initial.identities);
    assert.equal(result.scan.games[0].id, "ea:A,B");
    assert.deepEqual(result.identities, initial.identities);
  }
  const result = reconcileLauncherIdentities(scan(game("A,B"), { ...game("1,A"), installKey: undefined }), initial.identities);
  assert.deepEqual(result.scan.games.map(item => item.id), ["ea:A,B", "ea:1,A"]);
  assert.deepEqual(result.identities, initial.identities);
});

test("identity storage validates bounds, providers, unique IDs and registrations", () => {
  const entry = { key: one, id: "ea:1,A", productId: "1,A" };
  for (const entries of [[entry, entry], [entry, { ...entry, key: two }], [{ ...entry, key: "A title" }], [{ ...entry, id: "battlenet:wow" }], [{ ...entry, productId: "B,A" }]]) {
    assert.throws(() => parseLauncherIdentities(JSON.stringify({ version: 1, entries })));
  }
  assert.throws(() => parseLauncherIdentities("x".repeat(4 * 1024 * 1024 + 1)));
  assert.throws(() => parseLauncherIdentities(JSON.stringify({ version: 2, entries: [] })));
});

test("observations serialize, avoid redundant writes and never publish a failed persistence update", async () => {
  const values = new Map<string, string>(); let writes = 0, fail = false;
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw Error("full"); writes++; values.set(key, value); },
  } });
  try {
    const results = await Promise.all([observeLauncherIdentities(scan(game("1,A"))), observeLauncherIdentities(scan(game("A,B")))]);
    assert.deepEqual(results.map(result => result.games[0].id), ["ea:1,A", "ea:1,A"]);
    assert.equal(writes, 2);
    await observeLauncherIdentities(scan(game("A,B"))); assert.equal(writes, 2);
    const before = values.get(launcherIdentityKey);
    fail = true; await assert.rejects(observeLauncherIdentities(scan(game("B,C"))), /full/);
    assert.equal(values.get(launcherIdentityKey), before);
    fail = false; assert.equal((await observeLauncherIdentities(scan(game("B,C")))).games[0].id, "ea:1,A");
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
