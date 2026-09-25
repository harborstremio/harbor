import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function storageHarness() {
  const data = new Map<string, string>();
  const rejected = new Set<string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (rejected.has(key)) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
  };
  function load<T>(path: string, overrides: Record<string, unknown> = {}): T {
    const mocks = {
      react: { createContext: () => ({}) },
      "./profiles": {},
      "./cinemeta": { persistableAddonOrigin: () => undefined, persistableVideos: () => undefined },
      "./membership-operations": {
        captureMembershipProfile: () => ({ activeId: null, settingsLinked: true }),
        isMembershipItemInput: (input: { id: unknown }) => typeof input.id === "string",
      },
      "@/lib/cinemeta": {
        persistableAddonOrigin: () => undefined,
        persistableVideos: () => undefined,
      },
      ...overrides,
    };
    const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", "localStorage", output)(
      (name: string) => mocks[name as keyof typeof mocks] ?? {},
      module,
      module.exports,
      storage,
    );
    return module.exports as T;
  }
  return { data, rejected, load };
}

test("favorite removal acknowledges accepted storage and removes duplicate membership IDs only", () => {
  const h = storageHarness();
  const key = "fixture.favorites.default";
  h.data.set(
    key,
    JSON.stringify([
      { id: "one", name: "first" },
      { id: "two", name: "keep" },
      { id: "one", name: "duplicate" },
    ]),
  );
  const store = h
    .load<typeof import("../src/lib/media-list-store.tsx")>("../src/lib/media-list-store.tsx")
    .createMediaListStore("fixture.favorites.");
  assert.equal(
    store.setExternalSafely({ activeId: null, settingsLinked: true }, { id: "one" }, false).status,
    "removed",
  );
  assert.deepEqual(JSON.parse(h.data.get(key)!), [{ id: "two", name: "keep" }]);
});

test("favorite persistence rejection leaves the saved collection unchanged", () => {
  const h = storageHarness();
  const key = "fixture.favorites.default";
  h.data.set(key, '[{"id":"one"}]');
  h.rejected.add(key);
  const store = h
    .load<typeof import("../src/lib/media-list-store.tsx")>("../src/lib/media-list-store.tsx")
    .createMediaListStore("fixture.favorites.");
  assert.deepEqual(
    store.setExternalSafely({ activeId: null, settingsLinked: true }, { id: "one" }, false),
    { status: "error", reason: "storage-failed" },
  );
  assert.equal(h.data.get(key), '[{"id":"one"}]');
  assert.equal(store.hasExternal("default", "one"), true);
});

test("watchlist mutation rejects malformed data and storage failures without a memory-only success", () => {
  const h = storageHarness();
  const key = "harbor.watchlist.v1";
  h.data.set(key, '[{"id":"one","type":"movie"}]');
  h.rejected.add(key);
  const store = h.load<typeof import("../src/lib/watchlist.ts")>("../src/lib/watchlist.ts");
  assert.throws(() => store.setLocalWatchlistAcknowledged({ id: "one" }, false), /Quota/);
  assert.equal(store.watchlistHas("one"), true);
  h.rejected.clear();
  h.data.set(key, '[{"broken":true}]');
  assert.throws(() => store.setLocalWatchlistAcknowledged({ id: "two" }, true), /read/);
  assert.equal(h.data.get(key), '[{"broken":true}]');
});

test("manual episode write failure reloads accepted partial storage before retry", () => {
  const h = storageHarness();
  const on = "harbor.manualwatched.v1";
  const off = "harbor.manualunwatched.v1";
  h.data.set(on, '["tt123|1|1"]');
  h.data.set(off, "[]");
  h.rejected.add(off);
  const store = h.load<typeof import("../src/lib/manual-watched.ts")>(
    "../src/lib/manual-watched.ts",
  );
  assert.throws(
    () => store.setManualWatchedManyAcknowledged("tt123", [{ season: 1, episode: 1 }], false),
    /Quota/,
  );
  assert.equal(store.manualWatchedState("tt123", 1, 1), undefined);
  h.rejected.clear();
  store.setManualWatchedManyAcknowledged("tt123", [{ season: 1, episode: 1 }], false);
  assert.equal(store.manualWatchedState("tt123", 1, 1), false);
});
