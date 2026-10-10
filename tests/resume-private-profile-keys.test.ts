// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import ts from "typescript";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const SHARED = "harbor.resume";
const PRIVATE = (id: string) => `harbor.resume.private.v1.${id}`;

// Run the real resume module with isolated storage and a chosen private-profile scope.
function harness(privateProfileId: string | null) {
  const data = new Map<string, string>();
  const mocks: Record<string, unknown> = {
    "./cw-profile": { privateCwProfileId: () => privateProfileId },
  };
  const output = ts.transpileModule(read("src/lib/resume.ts"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "localStorage", output)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
      return mocks[name];
    },
    module,
    module.exports,
    {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  );
  return { api: module.exports as typeof import("../src/lib/resume"), data };
}

const keysIn = (data: Map<string, string>, key: string) =>
  Object.keys(JSON.parse(data.get(key) ?? "{}"));

test("local playback that passes its owner is readable under a private profile", () => {
  const { api, data } = harness("alice");
  api.saveResumeMs("tt1", 90_000, 1, 4, undefined, undefined, undefined, "alice");
  // The owner write must land in BOTH scopes, because reads resolve to the private key.
  assert.deepEqual(keysIn(data, SHARED), ["tt1|s1e4"]);
  assert.deepEqual(keysIn(data, PRIVATE("alice")), ["tt1|s1e4"]);
  assert.equal(api.readResumeMs("tt1", 1, 4), 90_000);
});

test("a local write that omits its owner is invisible to a private profile", () => {
  const { api, data } = harness("alice");
  api.saveResumeMs("tt1", 90_000, 1, 4);
  // This is the shape that broke player exit: written shared, read private.
  assert.deepEqual(keysIn(data, SHARED), ["tt1|s1e4"]);
  assert.equal(data.has(PRIVATE("alice")), false);
  assert.equal(api.readResumeMs("tt1", 1, 4), 0);
});

test("without a private profile the owner-less write is readable", () => {
  const { api } = harness(null);
  api.saveResumeMs("tt1", 90_000, 1, 4);
  assert.equal(api.readResumeMs("tt1", 1, 4), 90_000);
});

test("imported progress stays shared and never claims private ownership", () => {
  const { api, data } = harness("alice");
  api.saveResumeBatch([{ id: "tt2", ms: 1_000, season: 1, episode: 1 }]);
  assert.deepEqual(keysIn(data, SHARED), ["tt2|s1e1"]);
  assert.equal(data.has(PRIVATE("alice")), false);
});

test("clearing with an owner empties both scopes", () => {
  const { api, data } = harness("alice");
  api.saveResumeMs("tt1", 90_000, 1, 4, undefined, undefined, undefined, "alice");
  api.clearResume("tt1", 1, 4, "alice");
  assert.deepEqual(keysIn(data, SHARED), []);
  assert.deepEqual(keysIn(data, PRIVATE("alice")), []);
  assert.equal(api.readResumeMs("tt1", 1, 4), 0);
});

test("lastPlayedEpisode reads the same scope the owner write populated", () => {
  const { api } = harness("alice");
  api.saveResumeMs("tt1", 20_000, 1, 2, undefined, undefined, undefined, "alice");
  const last = api.lastPlayedEpisode("tt1");
  assert.equal(last?.season, 1);
  assert.equal(last?.episode, 2);
  assert.equal(last?.ms, 20_000);
});

test("lastPlayedEpisode finds nothing when the write skipped the private scope", () => {
  const { api } = harness("alice");
  api.saveResumeMs("tt1", 20_000, 1, 2);
  assert.equal(api.lastPlayedEpisode("tt1"), null);
});
