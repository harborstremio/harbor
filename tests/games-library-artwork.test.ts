import assert from "node:assert/strict";
import test from "node:test";
import { launcherGameSummary, type LauncherGame } from "../src/lib/games/launchers.ts";
import { launcherCatalogArtwork } from "../src/lib/games/launcher-discovery.ts";
import { WOW_CLASSIC_ART, wowClassicArt } from "../src/lib/games/wow-art.ts";

const install = (launcher: LauncherGame["launcher"], productId: string, name: string): LauncherGame => ({
  id: `${launcher}:${productId}`, launcher, productId, name, installPath: "W:/Games/Test", state: "installed", launchMode: "client",
});

test("installed Fortnite, League and Warcraft reuse verified artwork without changing their copy", () => {
  for (const [native, igdb] of [
    [install("epic", "fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite", "Fortnite"), 1905],
    [install("riot", "league_of_legends:live", "League of Legends"), 115],
    [install("battlenet", "wow", "World of Warcraft"), 123],
  ] as const) {
    const game = launcherGameSummary(native);
    assert.equal(game.capsule, launcherCatalogArtwork(igdb)?.capsule);
    assert.ok(game.portrait);
    assert.equal(game.id, native.id);
    assert.equal(game.name, native.name);
    assert.equal(game.steamId, undefined);
    assert.equal(game.igdbId, igdb);
  }
});

test("Classic uses its publisher artwork, never Retail metadata or a guessed expansion", () => {
  const anniversary = launcherGameSummary(install("battlenet", "wow_classic_anniversary", "Burning Crusade Classic"));
  assert.equal(anniversary.capsule, wowClassicArt("classicann", "Burning Crusade Classic").backdrop);
  assert.equal(anniversary.igdbId, undefined);
  const unknownSeason = launcherGameSummary(install("battlenet", "wow_classic_anniversary", "Future Classic season"));
  assert.equal(unknownSeason.capsule, WOW_CLASSIC_ART.backdrop);
  for (const native of [install("battlenet", "wowt", "World of Warcraft"), install("riot", "league_of_legends:pbe", "League of Legends"), install("epic", "other:other:Fortnite", "Fortnite")]) {
    assert.equal(launcherGameSummary(native).capsule, "");
  }
});

test("launcher-supplied cover keeps priority over a bundled catalog fallback", () => {
  const native = install("battlenet", "wow", "World of Warcraft");
  native.artwork = { capsule: "https://publisher.example/current-cover.jpg" };
  const game = launcherGameSummary(native);
  assert.equal(game.capsule, native.artwork.capsule);
  assert.equal(game.portrait, native.artwork.capsule);
});
