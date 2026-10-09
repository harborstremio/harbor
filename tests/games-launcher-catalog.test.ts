import assert from "node:assert/strict";
import test from "node:test";
import { detailEditionTarget, resolveDetailEdition } from "../src/lib/games/detail-edition.ts";
import { parseAtlasGame } from "../src/lib/games/igdb-data.ts";
import { findLauncherInstall, launcherGameSummary, launcherProductImage, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { addCollectionGame, createPersonalCollection, emptyPersonalCollections, parsePersonalCollections } from "../src/lib/games/personal-collections.ts";
import { readSavedGames, writeSavedGames } from "../src/lib/games/saved.ts";

const install = (productId: string): LauncherGame => ({ id: `battlenet:${productId}`, launcher: "battlenet", productId,
  name: "Localized installation title", installPath: "F:/Games/Test", state: "installed", launchMode: "play" });
const scan = (...games: LauncherGame[]): LauncherScan => ({ supported: true, games, clients: [{ launcher: "battlenet", installed: true }], warnings: [] });

test("Ubisoft public artwork keeps native identity without borrowing a storefront edition", () => {
  const cover = "https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/17319894db2463c9d82d789b3e46461f.jpg";
  const native: LauncherGame = { id: "ubisoft:57", launcher: "ubisoft", productId: "57", name: "Assassin's Creed Brotherhood",
    installPath: "F:/Games/Assassins Creed", state: "installed", launchMode: "play", artwork: { capsule: cover, hero: "https://publisher.example/scene.jpg", logo: "https://publisher.example/logo.png" } };
  const summary = launcherGameSummary(native);
  assert.equal(summary.capsule, native.artwork?.capsule);
  assert.equal(summary.id, native.id);
  assert.equal(summary.steamId, undefined);
  assert.equal(summary.igdbId, undefined);
  assert.equal(launcherGameSummary({ ...native, artwork: { hero: native.artwork?.hero } }).capsule, native.artwork?.hero);
  assert.equal(launcherGameSummary({ ...native, artwork: undefined }).capsule, "");
  assert.equal(findLauncherInstall({ ...summary, id: "ubisoft:26" }, { ...scan(native), clients: [{ launcher: "ubisoft", installed: true }] }), undefined);
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } } as Storage;
  writeSavedGames("ubi-test", [summary]);
  assert.equal(readSavedGames("ubi-test")[0].capsule, cover);
  const collection = addCollectionGame(createPersonalCollection(emptyPersonalCollections(), "Ubisoft", "ubi"), "ubi", summary);
  assert.equal(parsePersonalCollections(JSON.stringify(collection)).games[native.id].capsule, cover);
  for (const unsafe of [cover + "?token=private", cover.replace(".net/", ".net.evil.invalid/"), cover.replace("https:", "http:"), cover.replace("assets/", "assets/../"), "file:///F:/image.jpg", "data:image/png;base64,AAAA"]) {
    assert.equal(launcherProductImage(native.id, unsafe), "");
  }
  assert.equal(launcherProductImage("steam:420", cover), "");
  assert.equal(launcherProductImage("ubisoft:../57", cover), "");
});

test("Battle.net metadata follows exact products, independently of display language", () => {
  for (const [product, id] of [["fen", 125165], ["diablo3", 120], ["osi", 142803], ["d1", 125],
    ["prometheus", 125174], ["hs_beta", 1279], ["heroes", 7313], ["s1", 25683], ["w1r", 322108],
    ["w2r", 322109], ["w3", 111650], ["lazarus", 95062], ["odin", 119177]] as const) {
    const native = install(product), game = launcherGameSummary(native);
    assert.equal(game.id, native.id);
    assert.equal(game.name, native.name);
    assert.equal(game.igdbId, id);
    assert.equal(game.steamId, undefined);
    assert.equal(findLauncherInstall({ id: `igdb:${id}`, igdbId: id }, scan(native)), native);
  }
});

test("PTRs, Classic, shared clients and similarly named unknown products cannot inherit retail editions", () => {
  for (const product of ["fenris", "fen_ptr", "prometheus_test", "wowt", "wow_classic", "wow_classic_era", "wow_classic_anniversary", "s2", "auks", "pinta"]) {
    assert.equal(launcherGameSummary({ ...install(product), name: "Diablo IV" }).igdbId, undefined, product);
  }
  const native = install("prometheus");
  assert.equal(findLauncherInstall({ id: "igdb:8173", igdbId: 8173 }, scan(native)), undefined, "original Overwatch is a different record");
  assert.equal(findLauncherInstall({ id: "steam:2357570", steamId: 2357570, igdbId: 125174 }, scan(native)), undefined);
});

test("old native detail entries gain verified metadata without accepting stale Steam identity", () => {
  const old = { id: "battlenet:fen", name: "Diablo IV", capsule: "", platforms: ["Windows"], igdbId: 120, steamId: 2344520 };
  const target = detailEditionTarget(old);
  assert.equal(target.id, old.id);
  assert.equal(target.igdbId, 125165);
  assert.equal(target.steamId, undefined);
  const metadata = parseAtlasGame({ id: 125165, name: "Diablo IV", summary: "Verified catalog description", cover: { image_id: "co6som" },
    external_games: [{ external_game_source: 1, uid: "2344520" }] });
  const result = resolveDetailEdition(old, null, metadata);
  assert.equal(result.detail?.description, metadata.description);
  assert.equal(result.portableGame.id, old.id);
  assert.equal(result.portableGame.steamId, undefined);
  assert.equal(result.steamLinkId, 2344520, "catalog link is separate from the copy's identity");
  assert.equal(resolveDetailEdition(old, null, { ...metadata, igdbId: 120 }).detail, null);
});

test("Steam and Battle.net copies survive collection add order, enrichment and round trips independently", () => {
  const native = launcherGameSummary(install("fen"));
  const steam = { ...native, id: "steam:2344520", steamId: 2344520 };
  const catalog = { ...native, id: "igdb:125165" };
  for (const games of [[native, steam, catalog], [catalog, steam, native]]) {
    let store = createPersonalCollection(emptyPersonalCollections(), "Favorites", "one");
    for (const game of games) store = addCollectionGame(store, "one", game);
    store = addCollectionGame(store, "one", { ...native, name: "Updated Battle.net title" });
    const restored = parsePersonalCollections(JSON.stringify(store));
    assert.deepEqual([...restored.collections[0].gameIds].sort(), games.map(game => game.id).sort());
    assert.equal(restored.games[native.id].steamId, undefined);
    assert.equal(restored.games[steam.id].steamId, 2344520);
    assert.equal(restored.games[native.id].name, "Updated Battle.net title");
  }
});

test("saved native cards without metadata upgrade on read and retain their saved key", () => {
  const memory = new Map<string, string>();
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); } } as Storage;
  const old = { id: "battlenet:prometheus", name: "Overwatch 2", capsule: "", platforms: ["Windows"] };
  memory.set("harbor.games.saved.v1:catalog-test", JSON.stringify([old]));
  const restored = readSavedGames("catalog-test");
  assert.equal(restored[0].igdbId, 125174);
  assert.equal(restored[0].id, old.id);
  writeSavedGames("catalog-test", restored);
  assert.deepEqual(readSavedGames("catalog-test"), restored);
});
