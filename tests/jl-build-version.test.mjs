import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadConfigFromFile } from "vite";

test("the actual JL frontend configuration reports the Windows package version", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const native = JSON.parse(readFileSync(new URL("../src-tauri/tauri.jl-dev.conf.json", import.meta.url), "utf8"));
  const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, undefined, root);
  assert.ok(loaded, "Vite configuration loads");
  assert.equal(JSON.parse(loaded.config.define.__APP_VERSION__), native.version);
  assert.equal(native.version, "0.9.26");
});
