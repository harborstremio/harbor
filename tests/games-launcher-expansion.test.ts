import assert from "node:assert/strict";
import test from "node:test";
import { canLaunchGame, findLauncherInstall, isLauncherGameId, launcherGameSummary, type LauncherGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { emptyLibraryPreferences, patchLibraryPreferences, parseLibraryPreferences } from "../src/lib/games/library-preferences.ts";

function install(launcher: LauncherGame["launcher"], productId: string, state: LauncherGame["state"] = "installed"): LauncherGame {
  return { id: `${launcher}:${productId}`, launcher, productId, name: "Localized title", installPath: "F:/Games/Test", state, launchMode: "client" };
}
function scan(...games: LauncherGame[]): LauncherScan {
  return { supported: true, games, clients: games.map(game => ({ launcher: game.launcher, installed: true })), warnings: [] };
}
test("new provider IDs persist without loosening existing identity validation", () => {
  const valid = ["epic:fn:4fe75bbc5a674f4f9b356b5c90567da5:Fortnite", "gog:1207658940", "riot:league_of_legends:live",
    "riot:valorant:pbe", "rockstar:gta5_gen9", "rsi:star-citizen:live", "rsi:star-citizen:tech-preview", "bsg:eft", "bsg:arena"];
  for (const id of valid) assert.equal(isLauncherGameId(id), true, id);
  const preferences = patchLibraryPreferences(emptyLibraryPreferences(), valid, { pinned: true });
  const parsed = parseLibraryPreferences(JSON.stringify(preferences));
  for (const id of valid) assert.equal(parsed.entries[id]?.pinned, true, id);
  for (const id of ["epic:app", "epic:fn:item:app?action=install", "epic:fn:item:app:extra", "gog:01", "gog:-1",
    "riot:unknown:live", "riot:valorant:other", "rsi:star-citizen:Live", "rsi:squadron42:live", "bsg:tarkov", "rockstar:../gta5", "ubisoft:0001", "ea:Z,A"]) {
    assert.equal(isLauncherGameId(id), false, id);
  }
});
test("Star Citizen installed join requires the verified live identity", () => {
  const live = install("rsi", "star-citizen:live");
  const preview = install("rsi", "star-citizen:ptu");
  const catalog = { id: "igdb:1595", igdbId: 1595 };
  assert.equal(findLauncherInstall(catalog, scan(preview)), undefined);
  assert.equal(findLauncherInstall(catalog, scan(live, preview)), live);
  assert.equal(launcherGameSummary(preview).igdbId, undefined);
  assert.equal(findLauncherInstall({ id: preview.id, igdbId: 1595 }, scan(live, preview)), preview);
  assert.equal(findLauncherInstall({ id: "igdb:19128", igdbId: 19128 }, scan(live)), undefined);
});
test("Tarkov and Arena never share an installed state or a guessed title match", () => {
  const eft = install("bsg", "eft");
  const arena = install("bsg", "arena");
  assert.equal(findLauncherInstall({ id: "igdb:15536", igdbId: 15536 }, scan(arena)), undefined);
  assert.equal(findLauncherInstall({ id: "igdb:15536", igdbId: 15536 }, scan(eft, arena)), eft);
  assert.equal(findLauncherInstall({ id: "igdb:203610", igdbId: 203610 }, scan(eft, arena)), arena);
  assert.equal(findLauncherInstall({ id: "steam:3932890", steamId: 3932890, igdbId: 15536 }, scan(eft)), undefined);
});
test("catalog resolution rejects unavailable or ambiguous copies while exact copies keep their status", () => {
  for (const state of ["missing", "incomplete", "ambiguous"] as const) {
    const game = install("bsg", "eft", state);
    assert.equal(findLauncherInstall({ id: "igdb:15536", igdbId: 15536 }, scan(game)), undefined);
    assert.equal(findLauncherInstall({ id: game.id }, scan(game)), game);
    assert.equal(canLaunchGame(game, scan(game)), false);
  }
  const game = install("rsi", "star-citizen:live");
  assert.equal(findLauncherInstall({ id: "igdb:1595", igdbId: 1595 }, scan(game, { ...game, id: "another-copy" })), undefined);
  assert.equal(canLaunchGame(game, { ...scan(game), clients: [] }), false);
  assert.equal(findLauncherInstall({ id: game.id }, { ...scan(game), supported: false }), undefined);
});
test("Riot PBE and Rockstar Enhanced keep their edition identities", () => {
  assert.equal(launcherGameSummary(install("riot", "league_of_legends:live")).igdbId, 115);
  assert.equal(launcherGameSummary(install("riot", "league_of_legends:pbe")).igdbId, undefined);
  assert.equal(launcherGameSummary(install("rockstar", "gta5")).igdbId, 1020);
  assert.equal(launcherGameSummary(install("rockstar", "gta5_gen9")).igdbId, undefined);
});
