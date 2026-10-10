import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isAdultText } from "../src/lib/addons-store/adult-filter.ts";
import type { Addon } from "../src/lib/addons.ts";

function addon(transportUrl: string, id = "test.streams", adult = false): Addon {
  return { transportUrl, manifest: { id, name: id, version: "1", types: ["movie"], resources: ["stream"], behaviorHints: { adult } } } as Addon;
}

async function catalog(local: Addon[], account: Addon[], adultsAllowed = false) {
  const states: unknown[] = [];
  let cursor = 0;
  let initialized = false;
  const effects: (() => unknown)[] = [];
  const mocks: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!initialized) states[index] = initial;
        return [states[index], (value: unknown) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
      useEffect: (fn: () => unknown) => { if (!initialized) effects.push(fn); },
    },
    "@/lib/auth": { useAuth: () => ({ authKey: "fixture" }) },
    "@/lib/addons": { userAddons: async () => account },
    "@/lib/addon-store": { fetchInstalledAddons: async () => local },
    "@/lib/providers/stremio-addons": { listAddons: async () => ({ addons: [] }) },
    "./adult-filter": { isAdultText },
    "./community": { fetchCommunityAddons: async () => [], fetchManifest: async () => null },
    "./curated": { CURATED_ADDONS: [] },
  };
  const exports = {} as typeof import("../src/lib/addons-store/store.ts");
  const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/addons-store/store.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", "window", compiled)(
    (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, exports,
    { addEventListener() {}, removeEventListener() {} },
  );
  exports.useAddonsCatalog(adultsAllowed);
  initialized = true;
  const cleanup = effects.map(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  cursor = 0;
  const result = exports.useAddonsCatalog(adultsAllowed);
  for (const stop of cleanup) if (typeof stop === "function") stop();
  assert.equal(result.loading, false);
  return result;
}

test("same manifest with different configurations remains individually removable", async () => {
  const one = addon("https://addon.invalid/config-one/manifest.json");
  const two = addon("https://addon.invalid/config-two/manifest.json");
  const result = await catalog([one, two], [one]);
  assert.equal(result.byId.size, 1, "discovery still groups by manifest");
  assert.deepEqual(result.installedAddons.map(a => a.transportUrl), [one.transportUrl, two.transportUrl]);
  assert.equal(result.installedAddons[0].source, "stremio-user");
});

test("case-sensitive configuration paths remain distinct while host case is normalized", async () => {
  const result = await catalog([
    addon("https://ADDON.invalid/TokenA/manifest.json"),
    addon("https://addon.invalid/tokena/manifest.json"),
  ], [addon("https://addon.invalid/TokenA/manifest.json")]);
  assert.equal(result.installedAddons.length, 2);
});

test("installed rows retain hidden-provider and adult filtering", async () => {
  const items = [addon("https://a.invalid/manifest.json"), addon("https://b.invalid/manifest.json", "private.streams", true), addon("https://c.invalid/manifest.json", "com.opensubtitles.v3")];
  assert.equal((await catalog(items, [])).installedAddons.length, 1);
  assert.equal((await catalog(items, [], true)).installedAddons.length, 2);
});
