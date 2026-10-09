import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture() {
  const values = new Map<string, string>();
  const events: string[] = [];
  let quota = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (quota && key.startsWith("harbor.jl.library")) throw new DOMException("Full", "QuotaExceededError");
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  };
  const window = { dispatchEvent: (event: Event) => { events.push(event.type); } };
  function load<T>(name: string, mocks: Record<string, unknown> = {}): T {
    const exports = {};
    const code = ts.transpileModule(readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("require", "exports", "localStorage", "window", code)((key: string) => {
      assert.ok(key in mocks, `Unexpected dependency ${key}`);
      return mocks[key];
    }, exports, storage, window);
    return exports as T;
  }
  const local = load<typeof import("../src/lib/jl/local-library")>("lib/jl/local-library.ts");
  const library = load<typeof import("../src/lib/stremio")>("lib/stremio.ts", {
    "./jl/local-library": local,
    "@/lib/resume": { readResumeEntry: () => null, readResumeSource: () => null },
    "./anime-detect": { isDetectedAnime: () => false },
  });
  const setProfile = (id: string) => storage.setItem("harbor.profiles.v1", JSON.stringify({
    activeId: id, profiles: [{ id: "primary", isPrimary: true }, { id: "other" }, { id: "new-account" }],
  }));
  return { values, storage, events, local, library, load, setProfile, fill: () => { quota = true; } };
}

test("JL library retains arbitrary provider IDs, exact episode state, and profile isolation offline", async () => {
  const f = fixture();
  const a = f.local.localLibraryScope("primary");
  const b = f.local.localLibraryScope("other");
  const item = { _id: "provider:opaque/title", type: "series", name: "Fixture", removed: false, temp: false,
    _ctime: "2026-01-01", _mtime: "2026-01-02", state: { timeOffset: 32400, duration: 100000, season: 0, episode: 2, video_id: "source-exact-episode" } };
  await f.library.libraryPut(a, item);
  assert.deepEqual(await f.library.library(a), [item]);
  assert.deepEqual(await f.library.library(b), []);
  assert.deepEqual(f.events, ["jl:library-changed"]);
  assert.equal((await f.library.libraryIfChanged(a))[0].state?.video_id, "source-exact-episode");
  await f.library.removeStremioBookmark(a, item._id);
  const removed = (await f.library.library(a))[0];
  assert.equal(removed.removed, true);
  assert.equal(removed.temp, true);
  assert.deepEqual(removed.state, item.state);
});

test("legacy credentials are rejected rather than sent; malformed and full storage never acknowledge a write", async () => {
  const f = fixture();
  await assert.rejects(f.library.library("legacy-token-fixture"), /Choose a JL profile/);
  await assert.rejects(f.library.login("fixture@invalid", "not-a-real-password"), /JL Media Vision/);
  f.values.set("harbor.jl.library.v1.primary", "broken json");
  await assert.rejects(f.library.library(f.local.localLibraryScope("primary")));
  assert.equal(f.values.get("harbor.jl.library.v1.primary"), "broken json");
  f.values.delete("harbor.jl.library.v1.primary");
  f.fill();
  await assert.rejects(f.library.libraryPut(f.local.localLibraryScope("primary"), {
    _id: "tt1", type: "movie", name: "Fixture", removed: false, temp: false, _ctime: "now", _mtime: "now",
  }), /Full/);
  assert.equal(f.events.length, 0);
});

function addonsFixture() {
  const f = fixture();
  f.setProfile("primary");
  const requested: string[] = [];
  let pending: (() => Promise<Response>) | null = null;
  const fetchFixture = async (url: string) => {
    requested.push(url);
    if (pending) return pending();
    return new Response(JSON.stringify({ id: "fixture.addon", name: "Fixture", resources: ["stream"], types: ["movie"] }));
  };
  const store = f.load<typeof import("../src/lib/addon-store")>("lib/addon-store.ts", {
    "@/lib/safe-fetch": { safeFetch: fetchFixture, safeFetchLocal: fetchFixture },
    "@/lib/local-network": { isLocalNetworkUrl: () => false },
    "./addons-store/reorder": { applyOrderToItems: (items: unknown[]) => items, loadDisplayOrder: () => [], replaceUrlsInOrder: () => [], saveDisplayOrder: () => {} },
  });
  return { ...f, store, requested, defer: (fn: () => Promise<Response>) => { pending = fn; } };
}

test("addon protocol URL and credential-bearing query are preserved without external account requests", async () => {
  const f = addonsFixture();
  const one = "https://fixture.invalid/Config-A/manifest.json?token=FixtureCase";
  const two = "https://fixture.invalid/Config-B/manifest.json?token=DifferentCase";
  const parsed = f.store.parseAddonUrl("stremio://fixture.invalid/Config-A?token=FixtureCase");
  assert.deepEqual(parsed, { kind: "ok", url: one });
  await f.store.installFromUrl(one);
  await f.store.installFromUrl(two);
  assert.deepEqual(f.store.loadInstalled().map(a => a.transportUrl), [one, two]);
  assert.deepEqual(f.requested, [one, two]);
  await f.store.uninstallAddon("fixture.addon", one);
  assert.deepEqual(f.store.loadInstalled().map(a => a.transportUrl), [two]);
  assert.equal(f.requested.length, 2, "uninstall performs no account request");
});

test("reconfiguring one addon instance preserves another installation with the same manifest ID", async () => {
  const f = addonsFixture();
  const one = "https://fixture.invalid/config-a/manifest.json";
  const two = "https://fixture.invalid/config-b/manifest.json";
  const next = "https://fixture.invalid/config-new/manifest.json";
  await f.store.installFromUrl(one);
  await f.store.installFromUrl(two);
  await assert.rejects(f.store.installFromUrl(next, { replaceId: "fixture.addon" }), /Choose the addon configuration/);
  await f.store.installFromUrl(next, { replaceUrl: one });
  assert.deepEqual(f.store.loadInstalled().map(a => a.transportUrl), [two, next]);
});

test("addon install completion after a profile switch cannot write into the new profile", async () => {
  const f = addonsFixture();
  let complete!: (r: Response) => void;
  f.defer(() => new Promise(resolve => { complete = resolve; }));
  const install = f.store.installFromUrl("https://fixture.invalid/manifest.json");
  f.setProfile("other");
  complete(new Response(JSON.stringify({ id: "fixture", name: "Fixture" })));
  await assert.rejects(install, /Profile changed/);
  assert.equal(f.values.has("harbor.installed-addons.primary"), false);
  assert.equal(f.values.has("harbor.installed-addons.other"), false);
});

test("refreshing a missing manifest updates only its exact configured addon instance", async () => {
  const f = addonsFixture();
  const one = "https://fixture.invalid/config-a/manifest.json";
  const two = "https://fixture.invalid/config-b/manifest.json";
  f.store.saveInstalled([
    { id: "fixture.addon", transportUrl: one, installedAt: 1 },
    { id: "fixture.addon", transportUrl: two, installedAt: 2, manifest: { id: "fixture.addon", name: "Second configuration", resources: ["subtitles"] } },
  ]);
  await f.store.fetchInstalledAddons();
  assert.equal(f.store.loadInstalled()[1].manifest?.name, "Second configuration");
  assert.deepEqual(f.store.loadInstalled()[1].manifest?.resources, ["subtitles"]);
});

test("legacy local addons and disabled state migrate without losing original configured values", () => {
  const f = addonsFixture();
  const config = [{ id: "fixture", installedAt: 1, transportUrl: "https://fixture.invalid/KeepCase/config/manifest.json", manifest: { id: "fixture", name: "Fixture" } }];
  f.values.set("harbor.installed-addons", JSON.stringify(config));
  f.values.set("harbor.addons.disabled", JSON.stringify([config[0].transportUrl]));
  assert.deepEqual(f.store.loadInstalled(), config);
  assert.equal(f.store.isAddonEnabled(config[0].transportUrl), false);
  f.setProfile("other");
  assert.deepEqual(f.store.loadInstalled(), []);
});

test("account collection compatibility API only accesses current JL local profile", async () => {
  const f = addonsFixture();
  const addons = f.load<typeof import("../src/lib/addons")>("lib/addons.ts", {
    "@/lib/addon-catalog-cache": {}, "@/lib/run-lanes": {},
    "@/lib/safe-fetch": { safeFetch: () => { throw new Error("Unexpected account network"); } },
    "./addon-store": f.store, "./jl/local-library": f.local,
  });
  const scope = f.local.activeLocalLibraryScope();
  await assert.rejects(addons.userAddons("legacy-token"), /Choose a JL profile/);
  await f.store.installFromUrl("https://fixture.invalid/manifest.json");
  assert.equal((await addons.userAddons(scope)).length, 1);
  f.setProfile("other");
  await assert.rejects(addons.setUserAddons(scope, []), /profile changed/);
  assert.equal(f.values.has("harbor.installed-addons.other"), false);

  f.setProfile("primary");
  f.store.saveInstalled([{ id: "fixture", transportUrl: "https://fixture.invalid/manifest.json", installedAt: 1 }]);
  let complete!: (response: Response) => void;
  f.defer(() => new Promise(resolve => { complete = resolve; }));
  const pending = addons.userAddons(scope);
  f.setProfile("other");
  complete(new Response(JSON.stringify({ id: "fixture", name: "Fixture" })));
  await assert.rejects(pending, /profile changed/, "a late manifest read cannot return another profile's configuration");
});

test("addon order backups are profile scoped and legacy originals remain recoverable", () => {
  const f = fixture();
  const order = f.load<typeof import("../src/lib/addons-store/reorder")>("lib/addons-store/reorder.ts", { "@/lib/addons": {} });
  f.values.set("harbor.addonOrder", '["legacy-config"]');
  f.setProfile("primary");
  assert.deepEqual(order.loadDisplayOrder(), ["legacy-config"]);
  order.saveDisplayOrder(["primary-config"]);
  f.setProfile("other");
  assert.deepEqual(order.loadDisplayOrder(), []);
  order.saveDisplayOrder(["other-config"]);
  f.setProfile("new-account");
  assert.deepEqual(order.loadDisplayOrder(), []);
  assert.equal(f.values.get("harbor.addonOrder"), '["legacy-config"]');
});

test("JL runtime account entrypoints contain no external-account transport or token lookup", () => {
  for (const file of ["lib/auth.tsx", "lib/stremio.ts", "lib/addons.ts", "lib/addon-store.ts", "lib/stremio-library-repair.ts", "lib/account/stremio-link.ts", "lib/stremio-auth.ts"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /https:\/\/api\.strem\.io\/api|https:\/\/www\.stremio\.com\/(login|register)|getItem\(["']harbor\.auth/);
  }
});

test("pending progress for the same title stays separate across JL profiles and never loads the legacy token queue", async () => {
  const f = fixture();
  f.setProfile("primary");
  let fail = true;
  const wrote: Array<{ scope: string; offset: number }> = [];
  const queue = f.load<typeof import("../src/lib/stremio-write-queue")>("lib/stremio-write-queue.ts", {
    "./jl/local-library": f.local,
    "@/lib/stremio": {
      libraryGetOneStrict: async () => null,
      libraryPut: async (scope: string, item: { state: { timeOffset: number } }) => {
        if (fail) throw new Error("full storage");
        wrote.push({ scope, offset: item.state.timeOffset });
      },
    },
  });
  const item = { _id: "tt1", type: "movie", name: "Fixture", removed: false, temp: false,
    _ctime: "2026-01-01", _mtime: "2026-01-02", state: { timeOffset: 10, duration: 100, watched: "fixture", flaggedWatched: 1 } };
  const legacy = '[{"authKey":"not-a-real-token","item":{"_id":"legacy"}}]';
  f.values.set("harbor.stremio.write-queue.v1", legacy);
  assert.equal(await queue.cloudLibraryPut(f.local.activeLocalLibraryScope(), item), false);
  f.setProfile("other");
  assert.equal(queue.queuedWatched("tt1"), undefined);
  assert.equal(await queue.cloudLibraryPut(f.local.activeLocalLibraryScope(), { ...item, state: { ...item.state, timeOffset: 20 } }), false);
  fail = false;
  await queue.flushWriteQueue();
  assert.deepEqual(wrote, [{ scope: "jl-local:other", offset: 20 }]);
  f.setProfile("primary");
  assert.equal(queue.queuedWatched("tt1")?.flaggedWatched, 1);
  await queue.flushWriteQueue();
  assert.deepEqual(wrote[1], { scope: "jl-local:primary", offset: 10 });
  assert.equal(f.values.get("harbor.stremio.write-queue.v1"), legacy);
});
