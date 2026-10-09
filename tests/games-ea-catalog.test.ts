import test from "node:test";
import assert from "node:assert/strict";
import { findLauncherInstall, launcherCatalogGame, launcherDispatchId, launcherGameSummary, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { detailEditionTarget, resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { addCollectionGame, createPersonalCollection, emptyPersonalCollections, parsePersonalCollections } from "../src/lib/games/personal-collections.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";

const install = (productId: string): LauncherGame => ({ id: `ea:${productId}`, launcher: "ea", productId,
  name: "Localized installation title", installPath: "F:/Games/Test", state: "installed", launchMode: "play" });
const scan = (...games: LauncherGame[]): LauncherScan => ({ supported: true, games, clients: [{ launcher: "ea", installed: true }], warnings: [] });

test("EA Windows content IDs resolve independently of titles and keep native launch identity", () => {
  for (const [product, id] of [["alice2_dd", 1040], ["194908", 114795], ["16273025", 112104],
    ["deadspace_eu2", 37], ["1009228", 37], ["deadspace2_dd", 38], ["71762", 1216],
    ["16050355", 135243], ["198188", 119285], ["198196", 140839], ["198300", 201156],
    ["196485", 74701], ["1014457", 45113], ["sims3_dd", 260], ["1011164", 3212]] as const) {
    const native = install(product), game = launcherGameSummary(native);
    assert.equal(game.igdbId, id, product);
    assert.equal(game.id, native.id);
    assert.equal(game.name, native.name);
    assert.equal(game.steamId, undefined);
    assert.equal(launcherDispatchId(native), native.id);
    assert.equal(findLauncherInstall({ id: `igdb:${id}`, igdbId: id }, scan(native)), native);
  }
});

test("EA aliases require agreement; offers, trials and shared-edition aliases remain unresolved", () => {
  assert.equal(launcherGameSummary(install("1009228,deadspace_eu2")).igdbId, 37);
  for (const product of ["deadspace_eu2,1009228", "1009228,1009228", "1009228,deadspace2_dd", "1009228,unknown",
    "OFB-EAST:55107", "Origin.OFR.50.0001139", "16050355_fp", "16050355,16050355_fp", "1039093", "1034365", "sims3_dd_trial", "__proto__", ""]) {
    assert.equal(launcherGameSummary({ ...install(product), name: "The Sims 3" }).igdbId, undefined, product);
  }
  assert.equal(launcherCatalogGame({ id: "ea:sims3_dd,unknown", name: "The Sims 3", capsule: "", platforms: [] }).igdbId, undefined);
});

test("native metadata preserves originals and explicit collections instead of remakes or base editions", () => {
  const native = launcherGameSummary(install("1009228,deadspace_eu2"));
  const original = parseAtlasGame({ id: 37, name: "Dead Space", platforms: [6], summary: "Original 2008 PC game",
    cover: { image_id: "co1v89" }, external_games: [{ external_game_source: 1, uid: "17470" }] });
  const resolved = resolveDetailEdition(native, null, original);
  assert.equal(resolved.detail?.description, original.description);
  assert.equal(resolved.portableGame.id, native.id);
  assert.equal(resolved.portableGame.steamId, undefined);
  assert.equal(resolved.steamLinkId, 17470);
  assert.equal(resolveDetailEdition(native, null, { ...original, igdbId: 159119 }).detail, null);
  assert.equal(findLauncherInstall({ id: "igdb:159119", igdbId: 159119 }, scan(install("deadspace_eu2"))), undefined);
  assert.equal(findLauncherInstall({ id: "steam:17470", steamId: 17470, igdbId: 37 }, scan(install("deadspace_eu2"))), undefined);
  assert.equal(findLauncherInstall({ id: "igdb:224", igdbId: 224 }, scan(install("1014457"))), undefined);
  assert.equal(findLauncherInstall({ id: "igdb:37", igdbId: 37 }, scan(install("1009228"), install("deadspace_eu2"))), undefined);
});

test("EA registration continuity uses current aliases while Saved and collections retain their keys", () => {
  const native = { ...install("1009228,deadspace_eu2"), id: "ea:install.guid.observed" };
  const summary = launcherGameSummary(native);
  assert.equal(summary.igdbId, 37);
  assert.equal(summary.id, native.id);
  assert.equal(launcherDispatchId(native), "ea:1009228,deadspace_eu2");
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } } as Storage;
  const old = { id: "ea:sims3_dd", name: "The Sims 3", capsule: "", platforms: ["Windows"] };
  memory.set("harbor.games.saved.v1:ea-catalog", JSON.stringify([old]));
  assert.equal(readSavedGames("ea-catalog")[0].igdbId, 260);
  const stale = detailEditionTarget({ ...old, steamId: 47890, igdbId: 3212 });
  assert.equal(stale.igdbId, 260);
  assert.equal(stale.steamId, undefined);
  writeSavedGames("ea-catalog", [summary, stale]);
  assert.equal(readSavedGames("ea-catalog")[0].id, native.id);
  assert.equal(readSavedGames("ea-catalog")[0].igdbId, 37);
  const steam = { ...summary, id: "steam:17470", steamId: 17470 };
  let store = createPersonalCollection(emptyPersonalCollections(), "EA", "ea");
  for (const game of [summary, steam]) store = addCollectionGame(store, "ea", game);
  const restored = parsePersonalCollections(JSON.stringify(store));
  assert.deepEqual([...restored.collections[0].gameIds].sort(), [native.id, steam.id].sort());
  assert.equal(restored.games[native.id].steamId, undefined);
  assert.equal(restored.games[steam.id].steamId, 17470);
});
