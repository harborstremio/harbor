import assert from "node:assert/strict";
import test from "node:test";
import { downloadName, downloadFilename } from "../src/lib/games/transfers.ts";
import { cloudError } from "../src/lib/games/cloud-files.ts";

test("resolved cloud names preserve file type and cannot become a save path or device", () => {
  assert.equal(downloadName("Game.part02.rar"), "Game.part02.rar");
  assert.equal(downloadName("C:\\cloud\\雨の庭.zip"), "雨の庭.zip");
  assert.equal(downloadName("../../game.zip"), "game.zip");
  assert.equal(downloadName("NUL.zip"), "_NUL.zip");
  assert.equal(downloadName(" ?night*:garden.zip. "), "_night__garden.zip");
  assert.equal(downloadFilename("https://cdn.test/file?token=not-a-filename"), "file");
  assert.equal(downloadFilename("javascript:alert(1)"), "download");
});
test("unknown provider errors cannot expose credentials as UI copy", () => {
  assert.equal(cloudError("cloud_key"), "games.cloud.cloud_key");
  assert.equal(cloudError(new Error("cloud_not_ready")), "games.cloud.cloud_not_ready");
  assert.equal(cloudError("https://api.test/?token=private"), "games.cloud.cloud_network");
});
