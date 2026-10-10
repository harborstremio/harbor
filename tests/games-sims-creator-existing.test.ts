import test from "node:test";
import assert from "node:assert/strict";
import { simsCreatorExisting } from "../src/lib/games/sims-creator-existing.ts";
import type { SimsWorkspace } from "../src/lib/games/sims.ts";

function workspace(paths: string[]): SimsWorkspace {
  return { folder: { path: "W:/Test Sims", gameVersion: "1.128.90.1030", modsEnabled: true, scriptsEnabled: true, resourceReady: true, files: paths.map(path => ({ path, bytes: 10, kind: path.endsWith(".cfg") ? "settings" : path.endsWith(".package") ? "package" : "script", scriptTooDeep: false })), partial: false, saveRecovery: false }, state: { root: "W:/Test Sims", revision: "test", groups: [], backups: [] }, recoveryNeeded: false };
}
test("existing loose MCCC suggestions keep siblings together without taking other mods or asserting a version", () => {
  const data = workspace(["MCCC/mc_cmd_center.package", "MCCC/MC_CMD_CENTER.ts4script", "MCCC/mc_settings.cfg", "MCCC/other.package", "MCCC/other.cfg", "Other/mc_tuner.cfg", "Harbor-known/mc_cmd_center.package"]);
  const found = simsCreatorExisting(data);
  assert.equal(found.found, true); assert.equal(found.targets.length, 1);
  assert.equal(found.targets[0].version, undefined);
  assert.deepEqual(found.targets[0].sources, ["W:/Test Sims/Mods/MCCC/mc_cmd_center.package", "W:/Test Sims/Mods/MCCC/MC_CMD_CENTER.ts4script", "W:/Test Sims/Mods/MCCC/mc_settings.cfg"]);
});
test("incomplete or split core files and incomplete inventory never suggest a fresh installation", () => {
  for (const paths of [["mc_cmd_center.package"], ["One/mc_cmd_center.package", "Two/mc_cmd_center.ts4script"]]) {
    const found = simsCreatorExisting(workspace(paths)); assert.equal(found.found, true); assert.deepEqual(found.targets, []);
  }
  const partial = workspace([]); partial.folder.partial = true; assert.equal(simsCreatorExisting(partial).found, true);
  assert.deepEqual(simsCreatorExisting(workspace([])), { found: false, targets: [] });
});
test("canonical Windows and UNC sources retain native separators for reviewed adoption", () => {
  const data = workspace(["MCCC/mc_cmd_center.package", "MCCC/mc_cmd_center.ts4script"]);
  for (const root of [String.raw`\\?\W:\Test Sims`, String.raw`\\?\UNC\server\share\Test Sims`]) {
    data.folder.path = root;
    assert.equal(simsCreatorExisting(data).targets[0].sources![0], root + String.raw`\Mods\MCCC\mc_cmd_center.package`);
  }
});
test("managed and disabled manual groups require a selected update without invented creator metadata", () => {
  const data = workspace([]);
  data.state.groups = [{ id: "existing", title: "My old MCCC", enabled: false, files: ["mc_cmd_center.package", "mc_cmd_center.ts4script"].map(name => ({ name, bytes: 10, hash: "a".repeat(64) })), installedAt: 0, gameVersion: data.folder.gameVersion }];
  assert.deepEqual(simsCreatorExisting(data).targets, [{ key: "existing", label: "My old MCCC", groupId: "existing", version: undefined }]);
  data.state.groups[0].source = { provider: "mccc", version: "2026.5.0", gamePatch: data.folder.gameVersion, archiveHash: "a".repeat(64) };
  assert.equal(simsCreatorExisting(data).targets[0].version, "2026.5.0");
});
