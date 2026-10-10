import test from "node:test";
import assert from "node:assert/strict";
import { libraryMenuActions, managementCommand, managementFile, menuPosition, uninstallRoute } from "../src/lib/games/library-management.ts";
import type { QuickGame } from "../src/lib/games/quick-library.ts";

const steam = { id: "steam:10", name: "Game", ready: true, favorite: false, source: "steam", install: { appId: 10, state: "installed", update: "none" } } as QuickGame;
const custom = { ...steam, source: "custom", id: "custom:one", game: { steamId: 10 }, custom: { config: { executable: "D:\\Games\\Example\\Game.exe" } } } as unknown as QuickGame;
test("management targets the observed install, never its catalog metadata", () => {
  assert.deepEqual(managementCommand(steam, "uninstall"), { command: "games_manage_steam", args: { appId: 10, action: "uninstall" } });
  assert.equal(managementCommand(custom, "uninstall"), null);
  const launcher = { ...steam, source: "launcher", install: { id: "ea:old", launcher: "ea", productId: "new", state: "installed" } } as unknown as QuickGame;
  assert.deepEqual(managementCommand(launcher, "uninstall"), { command: "games_manage_launcher", args: { id: "ea:new", action: "client" } });
});
test("uninstall routes distinguish Steam, launcher handoff, OS fallback and saved games", () => {
  assert.equal(uninstallRoute(steam, true, true), "steam");
  assert.equal(uninstallRoute(custom, true, true), "windows");
  assert.equal(uninstallRoute(custom, true, false), null);
  assert.equal(uninstallRoute({ ...steam, source: "saved" } as QuickGame, true, true), null);
  assert.equal(uninstallRoute(steam, false, true), null);
  assert.equal(uninstallRoute({ ...steam, install: { ...steam.install, update: "uninstalling" } } as QuickGame, true, true), null);
});
test("browser menu offers no native actions or accidental install deletion", () => {
  assert.deepEqual(libraryMenuActions(steam, false, false), { main: ["favorite", "pin", "details", "notes", "gameplay", "trailer"], manage: ["hide"] });
  assert.ok(!libraryMenuActions(steam, true, true).manage.includes("remove"));
  assert.ok(libraryMenuActions(custom, true, true).manage.includes("remove"));
  assert.ok(libraryMenuActions(custom, true, true).manage.includes("desktop"));
  assert.ok(!libraryMenuActions({ ...custom, ready: false }, true, true).manage.includes("desktop"));
});
test("local file reveal never evaluates a shortcut command line or URL", () => {
  assert.equal(managementFile(custom), "D:\\Games\\Example\\Game.exe");
  const shortcut = (executable: string) => ({ ...steam, source: "shortcut", shortcut: { executable } } as unknown as QuickGame);
  assert.equal(managementFile(shortcut('"D:\\Games\\A B.exe"')), "D:\\Games\\A B.exe");
  for (const path of ["https://example.com", "steam://run/10", "cmd.exe /c something", "D:\\bad\nname.exe"]) assert.equal(managementFile(shortcut(path)), null);
});
test("menus clamp to every viewport edge, including flipped RTL submenus", () => {
  assert.deepEqual(menuPosition(1000, 900, 264, 300, 1024, 768), { left: 752, top: 460 });
  assert.deepEqual(menuPosition(-280, -50, 264, 300, 390, 844), { left: 8, top: 8 });
});
