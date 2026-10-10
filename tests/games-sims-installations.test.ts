import assert from "node:assert/strict";
import test from "node:test";
import { simsInstallations, simsInstallationKey } from "../src/lib/games/sims-installations.ts";
import { emptyLaunchConfig, type CustomGame } from "../src/lib/games/custom-library.ts";
import type { LauncherGame } from "../src/lib/games/launchers.ts";
import type { SteamInstall } from "../src/lib/games/installed.ts";

const steam = (change: Partial<SteamInstall> = {}): SteamInstall => ({ appId: 1222670, name: "Any display title", installPath: "D:/Games/The Sims 4", libraryPath: "D:/", state: "installed", sizeBytes: 0, lastPlayed: 0, ...change });
const ea = (change: Partial<LauncherGame> = {}): LauncherGame => ({ id: "ea:stable-install", launcher: "ea", productId: "1011164", name: "Any display title", installPath: "D:/Games/The Sims 4", state: "installed", launchMode: "client", ...change });
const custom = (change: Partial<CustomGame> = {}): CustomGame => ({ id: "custom-one", name: "Renamed copy", config: { ...emptyLaunchConfig(), executable: "D:/Games/The Sims 4/Game/Bin/TS4_x64.exe" }, linked: { id: "igdb:3212", igdbId: 3212, name: "The Sims 4", capsule: "", platforms: [] }, artwork: null, pinned: false, hidden: false, addedAt: 0, lastPlayed: 0, measuredSeconds: 0, ...change });

test("same physical spelling across Steam, EA and custom records produces one candidate with all sources", () => {
  const inputs = [[steam()], [ea({ installPath: "\\\\?\\d:\\games\\the sims 4\\" })], [custom()]] as const;
  const before = JSON.stringify(inputs);
  assert.deepEqual(simsInstallations(...inputs), [{ key: "d:\\games\\the sims 4", path: "D:\\Games\\The Sims 4", sources: ["steam", "ea", "custom"], custom: [{ executable: custom().config.executable, arguments: [] }] }]);
  assert.equal(JSON.stringify(inputs), before);
});

test("EA uses current exact product identity; known names, stale IDs and mixed aliases do not identify a copy", () => {
  const wrong = [ea({ productId: "sims3_dd", name: "The Sims 4" }), ea({ productId: "1011164,unknown" }), ea({ productId: "unknown", id: "ea:1011164" }), ea({ launcher: "epic", catalogSteamId: 1222670 })];
  assert.deepEqual(simsInstallations([steam({ appId: 47890, name: "The Sims 4" })], wrong, []), []);
  assert.equal(simsInstallations([], [ea({ id: "ea:old-record" })], []).length, 1);
});

test("only installed, stable copies are offered; unavailable and updating library records are excluded", () => {
  for (const state of ["missing", "updating"] as const) assert.equal(simsInstallations([steam({ state })], [], []).length, 0);
  for (const update of ["queued", "downloading", "paused", "validating", "repair", "uninstalling"] as const) assert.equal(simsInstallations([steam({ update })], [], []).length, 0);
  for (const state of ["missing", "incomplete", "ambiguous"] as const) assert.equal(simsInstallations([], [ea({ state })], []).length, 0);
  assert.equal(simsInstallations([steam({ update: "none" })], [], []).length, 1);
});

test("separate native custom copies are preserved and known executable variants resolve to their actual game roots", () => {
  const copies = ["TS4_x64.exe", "ts4_dx9_X64.EXE", "TS4_x64_fpb.exe"].map((exe, i) => custom({ id: String(i), config: { ...emptyLaunchConfig(), executable: `W:/Copies/${i}/Game/Bin/${exe}`, workingDirectory: "C:/Unrelated" } }));
  assert.deepEqual(simsInstallations([], [], copies).map(v => v.path), ["W:\\Copies\\0", "W:\\Copies\\1", "W:\\Copies\\2"]);
});

test("custom identity and executable must both match; hidden, unlinked and compatibility-runner copies are not inferred", () => {
  const copy = custom();
  const wrong = [custom({ hidden: true }), custom({ linked: null }), custom({ linked: { ...copy.linked!, steamId: 47890 } }), ...["wine", "proton"].map(mode => custom({ config: { ...copy.config, mode: mode as "wine" | "proton" } })), ...["D:/Game/TS4_x64.exe", "D:/Game/Bin/not-sims.exe", "D:/Game/Bin/TS4_x64.exe/extra", "D:/Launcher.exe"].map(executable => custom({ config: { ...copy.config, executable, workingDirectory: "D:/Games/The Sims 4" } }))];
  assert.deepEqual(simsInstallations([], [], wrong), []);
  assert.equal(simsInstallations([], [], [custom({ linked: { ...copy.linked!, steamId: 1222670 } })]).length, 1);
});

test("path normalization handles extended local/UNC paths without guessing relative, device or traversal locations", () => {
  assert.equal(simsInstallationKey("\\\\?\\UNC\\Server\\Share\\Sims 4\\"), "\\\\server\\share\\sims 4");
  assert.equal(simsInstallationKey("E:/Spiele/模拟人生 4"), "e:\\spiele\\模拟人生 4");
  for (const path of ["D:", "D:/", "/Games/Sims", "D:Games/Sims", "\\\\server\\share", "\\\\.\\device\\Sims", "D:/Games/../Sims", "D:/Games/./Sims", "D:/Games//Sims", "D:/Games/Sims.", "D:/Games/Sims ", "D:/Games/Sims:stream", "D:/Games/Sims\u0000", "D:/Games/?", "D:/" + "x".repeat(4096)]) {
    assert.equal(simsInstallationKey(path), undefined, path);
    assert.deepEqual(simsInstallations([steam({ installPath: path })], [], []), [], path);
  }
});
