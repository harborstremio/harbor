import assert from "node:assert/strict";
import test from "node:test";
import { chooseLauncherCatalog, LAUNCHER_CATALOG_LIMIT, launcherCatalogLookup, matchesLauncherCatalog } from "../src/lib/games/launcher-catalog.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { detailEditionTarget, resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { launcherGameSummary, type LauncherGame } from "../src/lib/games/launchers.ts";
import { addCollectionGame, createPersonalCollection, emptyPersonalCollections, parsePersonalCollections } from "../src/lib/games/personal-collections.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";

const game = { id: "gog:1207664663", name: "Localized install folder", capsule: "", platforms: ["Windows"] };
const metadata = (id = 1942, external: unknown[] = [{ external_game_source: 5, uid: "1207664663" }, { external_game_source: 1, uid: "292030" }], platform = 6) => parseAtlasGame({
  id, name: "The Witcher 3: Wild Hunt", summary: "Catalog description", platforms: [{ id: platform, name: platform === 6 ? "PC (Microsoft Windows)" : "macOS" }],
  cover: { image_id: "co1wyy" }, external_games: external,
});

test("GOG lookup uses the complete numeric product UID, never an installation title or numeric conversion", () => {
  assert.deepEqual(launcherCatalogLookup(game.id), { source: 5, uid: "1207664663" });
  assert.equal(launcherCatalogLookup("gog:1234567890123456789")?.uid, "1234567890123456789");
  for (const id of ["gog:0", "gog:0123", "gog:1207664663\";", "gog:../123", "steam:1207664663", "epic:fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite", "ubisoft:420", "ea:1207664663"]) {
    assert.equal(launcherCatalogLookup(id), undefined);
  }
});

test("external source and UID must match on the same record with Windows platform evidence", () => {
  assert.equal(matchesLauncherCatalog(game, metadata()), true);
  assert.equal(matchesLauncherCatalog(game, metadata(1942, [{ external_game_source: { id: 5 }, uid: "1207664663" }])) , true);
  assert.equal(matchesLauncherCatalog(game, metadata(1942, [{ external_game_source: 1, uid: "1207664663" }, { external_game_source: 5, uid: "different" }])), false);
  assert.equal(matchesLauncherCatalog(game, metadata(1942, undefined, 14)), false);
  assert.equal(matchesLauncherCatalog(game, { ...metadata(), externalIds: undefined }), false);
  assert.equal(matchesLauncherCatalog({ ...game, igdbId: 7346 }, metadata()), false);
});

test("ambiguous editions and incomplete result windows are not silently selected", () => {
  assert.equal(chooseLauncherCatalog(game, [metadata()])?.igdbId, 1942);
  assert.equal(chooseLauncherCatalog(game, [metadata(), metadata()])?.igdbId, 1942);
  assert.equal(chooseLauncherCatalog(game, [metadata(), metadata(7346)]), null);
  assert.equal(chooseLauncherCatalog(game, []), null);
  assert.equal(chooseLauncherCatalog(game, Array.from({ length: LAUNCHER_CATALOG_LIMIT }, () => metadata())), null);
  assert.equal(chooseLauncherCatalog(game, [metadata(7346, [{ external_game_source: 5, uid: "999" }]), metadata()])?.igdbId, 1942);
});

test("native detail, Saved and collections retain the GOG copy while exposing a separate Steam catalog link", () => {
  const target = detailEditionTarget({ ...game, steamId: 292030 });
  assert.equal(target.steamId, undefined);
  const result = resolveDetailEdition(target, null, metadata());
  assert.equal(result.portableGame.id, game.id);
  assert.equal(result.portableGame.igdbId, 1942);
  assert.equal(result.portableGame.steamId, undefined);
  assert.equal(result.detail?.description, "Catalog description");
  assert.equal(result.steamLinkId, 292030);
  assert.equal(resolveDetailEdition(target, null, metadata(1942, [{ external_game_source: 1, uid: "1207664663" }])).detail, null);
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } } as Storage;
  writeSavedGames("gog-catalog", [result.portableGame]);
  assert.equal(readSavedGames("gog-catalog")[0].id, game.id);
  assert.equal(readSavedGames("gog-catalog")[0].igdbId, 1942);
  assert.equal(readSavedGames("gog-catalog")[0].steamId, undefined);
  let collections = createPersonalCollection(emptyPersonalCollections(), "RPGs", "rpgs");
  collections = addCollectionGame(collections, "rpgs", result.portableGame);
  collections = addCollectionGame(collections, "rpgs", { ...result.portableGame, id: "steam:292030", steamId: 292030 });
  assert.equal(parsePersonalCollections(JSON.stringify(collections)).collections[0].gameIds.length, 2);
});

test("Fortnite resolves only the verified Epic installation tuple to the main game", () => {
  const install: LauncherGame = { id: "epic:fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite", launcher: "epic", productId: "fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite",
    name: "Fortnite", installPath: "F:/Epic/Fortnite", state: "installed", launchMode: "play" };
  const summary = launcherGameSummary(install);
  assert.equal(summary.igdbId, 1905);
  assert.equal(summary.id, install.id);
  assert.equal(summary.steamId, undefined);
  for (const productId of ["other:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite", "fn:other:Fortnite", "fn:4fe75bbc5a674f4f9b356b5c90567da5:FortniteTest"]) {
    assert.equal(launcherGameSummary({ ...install, id: `epic:${productId}`, productId }).igdbId, undefined);
  }
  assert.equal(detailEditionTarget({ ...summary, igdbId: 395833 }).igdbId, 1905, "a saved native card cannot become the separate Save the World record");
});

test("Ubisoft metadata follows the publisher's Steam association without becoming a Steam copy", () => {
  const install: LauncherGame = { id: "ubisoft:1081", launcher: "ubisoft", productId: "1081", name: "Localized title", installPath: "F:/Ubisoft/game", state: "installed", launchMode: "play", catalogSteamId: 3159330 };
  const summary = launcherGameSummary(install);
  assert.equal(summary.catalogSteamId, 3159330);
  assert.equal(summary.steamId, undefined);
  assert.deepEqual(launcherCatalogLookup(summary.id, summary.catalogSteamId), { source: 1, uid: "3159330" });
  const metadata = parseAtlasGame({ id: 300976, name: "Assassin's Creed Shadows", summary: "Exact publisher association", platforms: [{ id: 6, name: "Windows" }], external_games: [{ external_game_source: 1, uid: "3159330" }] });
  const detail = resolveDetailEdition(summary, null, metadata);
  assert.equal(detail.detail?.description, "Exact publisher association");
  assert.equal(detail.portableGame.id, "ubisoft:1081");
  assert.equal(detail.portableGame.catalogSteamId, 3159330);
  assert.equal(detail.portableGame.steamId, undefined);
  assert.equal(detail.steamLinkId, 3159330);
  assert.equal(resolveDetailEdition({ ...summary, catalogSteamId: 359550 }, null, metadata).detail, null);
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } } as Storage;
  writeSavedGames("ubi-catalog", [detail.portableGame]);
  assert.equal(readSavedGames("ubi-catalog")[0].catalogSteamId, 3159330);
  assert.equal(readSavedGames("ubi-catalog")[0].id, "ubisoft:1081");
  let collections = createPersonalCollection(emptyPersonalCollections(), "Games", "games");
  collections = addCollectionGame(collections, "games", detail.portableGame);
  assert.equal(parsePersonalCollections(JSON.stringify(collections)).games["ubisoft:1081"].catalogSteamId, 3159330);
  for (const id of ["ubisoft:0", "ea:1081", "epic:a:b:c", "steam:1081"]) assert.equal(launcherCatalogLookup(id, 3159330), undefined);
  for (const value of [0, -1, NaN, Infinity, 1.1, 0x1_0000_0000]) assert.equal(launcherCatalogLookup("ubisoft:1081", value), undefined);
});
