import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const notes = JSON.parse(read("src/lib/updater/bundled-release-notes.json"));

test("beta app and managed installer versions agree", () => {
  const version = JSON.parse(read("package.json")).version;
  for (const path of [
    "package.json",
    "src-tauri/tauri.conf.json",
    "installer/package.json",
    "installer/src-tauri/tauri.conf.json",
  ]) {
    assert.equal(JSON.parse(read(path)).version, version, path);
  }
  for (const [path, name] of [
    ["src-tauri", "harbor"],
    ["installer/src-tauri", "harbor-setup"],
  ]) {
    assert.ok(read(path + "/Cargo.toml").includes('version = "' + version + '"'));
    assert.ok(
      read(path + "/Cargo.lock").includes('name = "' + name + '"\nversion = "' + version + '"'),
    );
  }
});

test("beta 0.9.126 notes load offline without substituting stable notes", async () => {
  const module = { exports: {} };
  let requests = 0;
  const dependencies = {
    "@/lib/safe-fetch": {
      safeFetch: async () => {
        requests++;
        throw new Error("Offline");
      },
    },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://example.invalid" },
    "./bundled-release-notes.json": { default: notes },
  };
  const { outputText } = ts.transpileModule(read("src/lib/updater/release-notes.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  new Function("require", "module", "exports", outputText)(
    (name) => {
      assert.ok(Object.hasOwn(dependencies, name));
      return dependencies[name];
    },
    module,
    module.exports,
  );
  assert.equal((await module.exports.releaseNote("0.9.126")).title, "Harbor Beta 0.9.126");
  assert.equal(requests, 0);
  assert.equal(await module.exports.releaseNote("0.9.22"), null);
  assert.equal(requests, 1);
});

test("beta notes disclose pending live testing and exclude the private reporting site", () => {
  const text = JSON.stringify(notes.notes["0.9.126"]);
  assert.match(text, /live verification is still pending/);
  assert.match(text, /not a universal fix for fullscreen stuttering/);
  assert.doesNotMatch(text, /harborsystem\.online/i);
  assert.doesNotMatch(text, /beta candidate|0\.9\.22|stable.*will follow/i);
  assert.ok(
    notes.notes["0.9.126"].sections.some((section) => section.heading === "A note from Talal"),
  );
  assert.match(text, /Please hide passwords, tokens, and private links/);
  assert.equal(notes.notes["0.9.125"].title, "Harbor Beta 0.9.125");
});
