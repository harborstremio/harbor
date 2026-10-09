import assert from "node:assert/strict";
import test from "node:test";
import { emptyBattleNetAccount, withBattleNetAccount, battleNetAccountError, type BattleNetAccountStatus } from "../src/lib/games/battlenet-account.ts";
import { canLaunchGame, type LauncherScan } from "../src/lib/games/launchers.ts";
import { unifiedLibrary, filterUnifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";
const status: BattleNetAccountStatus = { ...emptyBattleNetAccount(), connection: "one", importUninstalled: true, snapshot: {
  modern: { updatedAt: 1, unresolved: 0, games: [{ id: "battlenet:fen", productId: "fen", name: "Diablo IV" }, { id: "battlenet:osi", productId: "osi", name: "Diablo II: Resurrected" }] },
  classic: { updatedAt: 1, unresolved: 0, games: [{ id: "battlenet:classic:d2", productId: "classic:d2", name: "Diablo II" }] },
} };
const scan: LauncherScan = { supported: true, clients: [{ launcher: "battlenet", installed: true }], warnings: [], games: [{ id: "battlenet:fen", productId: "fen", name: "Diablo IV", launcher: "battlenet", installPath: "D:/Games/Diablo IV", state: "installed", launchMode: "play" }] };
test("account imports merge only exact installed identities and do not authorize launch", () => {
  const value = withBattleNetAccount(scan, status)!;
  assert.equal(value.games.length, 3); assert.equal(value.games[0].state, "installed"); assert.equal(value.games[0].accountOwned, true);
  assert.equal(value.games[1].state, "notInstalled"); assert.equal(canLaunchGame(value.games[1], value), false);
  assert.notEqual(value.games[1].id, value.games[2].id); assert.equal(scan.games.length, 1); assert.equal(scan.games[0].accountOwned, undefined);
});
test("installed and uninstalled preferences are independent and do not re-add hidden installations", () => {
  assert.deepEqual(withBattleNetAccount(scan, { ...status, importInstalled: false })!.games.map(g => g.id), ["battlenet:osi", "battlenet:classic:d2"]);
  assert.equal(withBattleNetAccount(scan, { ...status, importInstalled: false, importUninstalled: false })!.games.length, 0);
  assert.equal(withBattleNetAccount(scan, emptyBattleNetAccount())!.games.length, 1);
});
test("unavailable and incomplete scans preserve unknown installation state", () => {
  const unknown = withBattleNetAccount(null, status)!;
  assert.equal(unknown.games.length, 3); assert.ok(unknown.games.every(g => g.state === "unknown"));
  assert.equal(withBattleNetAccount({ ...scan, warnings: ["battle_database"] }, status)!.games[1].state, "unknown");
});
test("account games reach the ordinary library availability filter without fabricated playtime", () => {
  const games = unifiedLibrary({ installed: [], steamKnown: true, custom: [], retro: EMPTY_EMULATION(), preferences: emptyLibraryPreferences(), launchers: withBattleNetAccount(scan, status), launchersKnown: true });
  const filtered = filterUnifiedLibrary(games, { ...unifiedLibraryDefaults(), availability: "notInstalled" });
  assert.equal(filtered.length, 2); assert.ok(filtered.every(g => g.source === "battlenet" && !g.quick?.ready && g.lastPlayed === 0));
});
test("account errors preserve actionable expiry and cancellation meanings", () => {
  assert.equal(battleNetAccountError("battlenet_account_canceled"), null);
  assert.equal(battleNetAccountError(new Error("battlenet_account_expired")), "games.battlenet.expired");
  assert.equal(battleNetAccountError("Command games_battlenet_account not found"), "games.battlenet.update");
});
