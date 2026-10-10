import assert from "node:assert/strict";
import test from "node:test";
import { canLaunchGame, findLauncherInstall, launcherDispatchId, launcherGameSummary, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { unifiedLibrary, filterUnifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences, patchLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const game = (productId = "classic:d2"): LauncherGame => ({ id: `battlenet:${productId}`, productId, launcher: "battlenet", name: "Classic edition", installPath: "D:/Fixture", state: "installed", launchMode: "direct" });
const scan = (games = [game()]): LauncherScan => ({ supported: true, clients: [{ launcher: "battlenet", installed: false }], games, warnings: [] });

test("four installed classic games work without requiring the modern launcher", () => {
  for (const id of ["classic:d2", "classic:d2x", "classic:w3", "classic:w3x"]) {
    const item = game(id);
    assert.equal(canLaunchGame(item, scan([item])), true);
    assert.equal(launcherDispatchId(item), item.id);
    for (const state of ["missing", "incomplete", "ambiguous"] as const) assert.equal(canLaunchGame({ ...item, state }, scan()), false);
    assert.equal(canLaunchGame(item, { ...scan(), supported: false }), false);
  }
  for (const item of [game("classic:other"), game("w3"), { ...game(), launcher: "ea" as const }, { ...game(), launchMode: "client" as const }]) assert.equal(canLaunchGame(item, scan()), false);
});

test("original editions have separate metadata and art; modern copies never borrow their launch state", () => {
  const entries = [["classic:d2", 126], ["classic:d2x", 246], ["classic:w3", 132], ["classic:w3x", 133]] as const;
  for (const [productId, id] of entries) {
    const summary = launcherGameSummary(game(productId));
    assert.equal(summary.igdbId, id);
    assert.match(summary.capsule, /t_screenshot_big\//);
    assert.match(summary.portrait!, /t_cover_big_2x\//);
    assert.equal(summary.steamId, undefined);
    assert.equal(findLauncherInstall({ id: `igdb:${id}`, igdbId: id }, scan([game(productId)]))?.productId, productId);
  }
  assert.equal(launcherGameSummary(game("w3")).igdbId, 111650);
  assert.equal(launcherGameSummary(game("osi")).igdbId, 142803);
  assert.equal(findLauncherInstall({ id: "igdb:111650", igdbId: 111650 }, scan([game("classic:w3")])), undefined);
});

test("classic games use existing library readiness, source filters and isolated preferences", () => {
  const classics = [game(), game("classic:d2x"), game("classic:w3"), game("classic:w3x")];
  const modern: LauncherGame = { ...game("w3"), launchMode: "play" };
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), [classics[0].id], { pinned: true });
  const rows = unifiedLibrary({ installed: [], steamKnown: true, custom: [], retro: EMPTY_EMULATION(), launchersKnown: true, preferences, launchers: scan([...classics, modern]) });
  assert.equal(rows.length, 5);
  assert.equal(rows.filter(row => row.state === "ready").length, 4);
  assert.equal(rows.find(row => row.id === modern.id)?.state, "setup");
  assert.deepEqual(rows.filter(row => row.favorite).map(row => row.id), [classics[0].id]);
  assert.equal(filterUnifiedLibrary(rows, { ...unifiedLibraryDefaults(), source: "battlenet" }).length, 5);
});
