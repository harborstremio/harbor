// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const bundled = JSON.parse(read("src/lib/updater/bundled-release-notes.json"));

function harness() {
  let requests = 0;
  const mocks: Record<string, unknown> = {
    "@/lib/safe-fetch": {
      safeFetch: async () => {
        requests++;
        return {
          ok: true,
          json: async () => ({ notes: { "0.9.124": { title: "Previous beta" } } }),
        };
      },
    },
    "@/lib/config/endpoints": { HARBOR_API_BASE: "https://example.invalid" },
    "./bundled-release-notes.json": { default: bundled },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(read("src/lib/updater/release-notes.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("require", "module", "exports", output)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name));
      return mocks[name];
    },
    module,
    module.exports,
  );
  return {
    api: module.exports as typeof import("../src/lib/updater/release-notes"),
    requests: () => requests,
  };
}

test("beta 0.9.125 notes are available without making a network request", async () => {
  const h = harness();
  assert.equal((await h.api.releaseNote("0.9.125"))?.title, "Harbor Beta 0.9.125");
  assert.equal(h.requests(), 0);
  assert.equal(await h.api.releaseNote(null), null);
});

test("bundled beta notes never substitute for another version", async () => {
  const h = harness();
  assert.equal((await h.api.releaseNote("0.9.124"))?.title, "Previous beta");
  assert.equal(await h.api.releaseNote("0.999.3"), null);
  assert.equal(h.requests(), 1);
});

test("beta notes include Talal's note and credits without advertising the private report system", () => {
  const note = bundled.notes["0.9.125"];
  assert.ok(note.sections.some((s: { heading: string }) => s.heading === "A note from Talal"));
  assert.match(JSON.stringify(note), /stable release will be published soon/);
  assert.doesNotMatch(JSON.stringify(note), /harborsystem\.online/i);
  assert.match(JSON.stringify(note), /Thunderhawkk/);
});
