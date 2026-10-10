import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture(initial, fail = () => null) {
  const values = new Map(Object.entries(initial));
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({
      activeId: "primary",
      profiles: [{ id: "primary", isPrimary: true }],
    }),
  );
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      const failure = fail(key);
      if (failure === "throw") throw new Error("Synthetic storage failure");
      if (failure !== "drop") values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  const mocks = {
    "@/lib/safe-fetch": {},
    "@/lib/local-network": {},
    "./addons-store/reorder": {},
  };
  const exports = {};
  const source = readFileSync(new URL("../src/lib/addon-store.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", "localStorage", code)(
    (name) => {
      assert.ok(Object.hasOwn(mocks, name), "Unexpected dependency: " + name);
      return mocks[name];
    },
    exports,
    storage,
  );
  return { values, store: exports };
}

const legacyUrl = "https://fixture.invalid/Legacy/manifest.json?config=LegacyCase";
const scopedUrl = "https://fixture.invalid/Scoped/manifest.json?config=ScopedCase";
const legacy = JSON.stringify([{ id: "same.addon", transportUrl: legacyUrl, installedAt: 1 }]);
const scoped = JSON.stringify([{ id: "same.addon", transportUrl: scopedUrl, installedAt: 2 }]);
const legacyDisabled = JSON.stringify([legacyUrl]);
const scopedDisabled = JSON.stringify([scopedUrl]);

test("conflicting legacy addon and disabled records remain byte-identical for recovery", () => {
  const initial = {
    "harbor.installed-addons": legacy,
    "harbor.installed-addons.primary": scoped,
    "harbor.addons.disabled": legacyDisabled,
    "harbor.addons.disabled.primary": scopedDisabled,
  };
  const { values, store } = fixture(initial);
  assert.deepEqual(
    store.loadInstalled().map((addon) => addon.transportUrl),
    [scopedUrl],
  );
  assert.equal(store.isAddonEnabled(scopedUrl), false);
  assert.equal(
    store.isAddonEnabled(legacyUrl),
    true,
    "conflicts do not silently merge enabled state",
  );
  for (const [key, value] of Object.entries(initial)) assert.equal(values.get(key), value);
});

test("a conflicting addon collection cannot import legacy enabled state into that profile", () => {
  const { values, store } = fixture({
    "harbor.installed-addons": legacy,
    "harbor.installed-addons.primary": scoped,
    "harbor.addons.disabled": scopedDisabled,
  });
  assert.deepEqual(
    store.loadInstalled().map((addon) => addon.transportUrl),
    [scopedUrl],
  );
  assert.equal(store.isAddonEnabled(scopedUrl), true);
  assert.equal(values.has("harbor.addons.disabled.primary"), false);
  assert.equal(values.get("harbor.addons.disabled"), scopedDisabled);
  assert.equal(values.get("harbor.installed-addons"), legacy);
});

test("differing legacy disabled bytes remain recoverable when the addon list is already scoped", () => {
  const { values, store } = fixture({
    "harbor.installed-addons.primary": scoped,
    "harbor.addons.disabled": legacyDisabled,
    "harbor.addons.disabled.primary": scopedDisabled,
  });
  assert.equal(store.isAddonEnabled(scopedUrl), false);
  assert.equal(values.get("harbor.addons.disabled"), legacyDisabled);
  assert.equal(values.get("harbor.addons.disabled.primary"), scopedDisabled);
});

for (const failure of ["throw", "drop"]) {
  for (const destination of ["harbor.installed-addons.primary", "harbor.addons.disabled.primary"]) {
    test(`legacy ${destination} bytes survive a ${failure} copy failure`, () => {
      const initial = {
        "harbor.installed-addons": legacy,
        "harbor.addons.disabled": legacyDisabled,
      };
      if (destination === "harbor.addons.disabled.primary")
        initial["harbor.installed-addons.primary"] = legacy;
      let attempts = 0;
      const { values, store } = fixture(initial, (key) => {
        if (key !== destination) return null;
        attempts++;
        return failure;
      });
      store.loadInstalled();
      assert.equal(attempts, 1, "the requested failing copy was exercised");
      assert.equal(values.get("harbor.addons.disabled"), legacyDisabled);
      assert.equal(values.has(destination), false);
      if (destination === "harbor.addons.disabled.primary")
        assert.equal(values.get("harbor.installed-addons.primary"), legacy);
      else assert.equal(values.get("harbor.installed-addons"), legacy);
    });
  }
}

test("verified identical copies can retire legacy keys without rewriting configured URLs", () => {
  const { values, store } = fixture({
    "harbor.installed-addons": legacy,
    "harbor.addons.disabled": legacyDisabled,
  });
  assert.deepEqual(
    store.loadInstalled().map((addon) => addon.transportUrl),
    [legacyUrl],
  );
  assert.equal(values.get("harbor.installed-addons.primary"), legacy);
  assert.equal(values.get("harbor.addons.disabled.primary"), legacyDisabled);
  assert.equal(values.has("harbor.installed-addons"), false);
  assert.equal(values.has("harbor.addons.disabled"), false);
});
