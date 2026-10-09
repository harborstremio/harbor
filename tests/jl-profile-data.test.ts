import assert from "node:assert/strict";
import test from "node:test";
import { mergeProfileValues, sameValue, syncProfileDocument, type SyncValues } from "../src/lib/jl/account/document-sync.ts";
import { readProfileData, applyProfileData, validateProfileData } from "../src/lib/jl/account/profile-data.ts";
import { createProfileDocumentRemote } from "../src/lib/jl/account/profile-data-remote.ts";
import { syncFavoriteRows } from "../src/lib/jl/account/favorites-sync.ts";

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test("JSONB property ordering does not produce a false conflict", () => {
  assert.equal(sameValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }), true);
});
test("first pull preserves independent items and account wins exact conflicts", () => {
  const result = mergeProfileValues(null, { a: 1, conflict: "local" }, { b: 2, conflict: "remote" });
  assert.deepEqual(result.values, { a: 1, conflict: "remote", b: 2 });
  assert.deepEqual(result.conflicts, [{ key: "conflict", local: "local", remote: "remote" }]);
});
test("offline item deletions persist while unrelated remote additions survive", () => {
  assert.deepEqual(mergeProfileValues({ a: 1 }, {}, { a: 1, b: 2 }).values, { b: 2 });
  assert.deepEqual(mergeProfileValues({ a: 1 }, { a: 1 }, {}).values, {});
});
test("a compare-and-swap conflict re-pulls and preserves the other device's addition", async () => {
  let attempts = 0, base: SyncValues | null = null, applied: SyncValues = {};
  await syncProfileDocument({ assertCurrent: () => {}, readLocal: () => ({ mine: 1 }), readBase: () => base,
    apply: (v) => { applied = v; }, checkpoint: (v) => { base = v; }, conflicts: () => {},
    pull: async () => ({ revision: attempts, values: attempts ? { theirs: 2 } : {} }),
    compareAndSwap: async () => ++attempts > 1 });
  assert.equal(attempts, 2);
  assert.deepEqual(applied, { mine: 1, theirs: 2 });
  assert.deepEqual(base, applied);
});
test("failed network and stale identity never apply or acknowledge pending data", async () => {
  let ack = false, current = true;
  const ports = { assertCurrent: () => { if (!current) throw new Error("changed"); }, readLocal: () => ({ mine: 1 }), readBase: () => null,
    apply: () => { ack = true; }, checkpoint: () => { ack = true; }, conflicts: () => {},
    pull: async () => ({ revision: 0, values: {} }), compareAndSwap: async () => { throw new Error("offline"); } };
  await assert.rejects(syncProfileDocument(ports), /offline/);
  assert.equal(ack, false);
  await assert.rejects(syncProfileDocument({ ...ports, compareAndSwap: async () => { current = false; return true; } }), /changed/);
  assert.equal(ack, false);
});
test("wire allowlist strips configured addon URLs, stream URLs, artwork tokens and credentials", () => {
  const s = storage();
  s.setItem("harbor.favorites.v1.p", JSON.stringify([{ id: "custom:123", type: "movie", name: "Title", poster: "https://art.test/?token=private", addonOrigin: { id: "plugin", base: "https://host.test/secret" }, videos: [{ streams: [{ url: "https://private" }] }] }]));
  s.setItem("harbor.installed-addons.p", JSON.stringify([{ id: "my.plugin", transportUrl: "https://host.test/PRIVATE/manifest.json" }]));
  const data = readProfileData(s, "p", { rdKey: "PRIVATE", uiLanguage: "en", defaultPlaybackSpeed: 1 });
  const wire = JSON.stringify(data);
  assert.equal(wire.includes("https"), false);
  assert.equal(wire.includes("PRIVATE"), false);
  assert.deepEqual(data["addon:my.plugin"], { enabled: true });
  assert.deepEqual(data["favorites:custom:123"], { id: "custom:123", type: "movie", name: "Title" });
});
test("library timestamps, provider IDs and nested progress retain compatible shape", () => {
  const s = storage();
  const item = { _id: "addon:series:1", type: "series", name: "Show", removed: false, temp: true, _ctime: "2026-10-09T00:00:00Z", _mtime: "2026-10-09T01:00:00Z", state: { timeOffset: 42000, duration: 60000, season: 0, episode: 1, video_id: "provider-special-1" } };
  s.setItem("harbor.jl.library.v1.p", JSON.stringify([item]));
  const values = readProfileData(s, "p", {});
  assert.deepEqual(values["library:addon:series:1"], item);
  applyProfileData(s, "other", values, {}, {});
  assert.deepEqual(JSON.parse(s.getItem("harbor.jl.library.v1.other")!), [item]);
});
test("remote apply preserves local-only artwork/config and edits made during a request", () => {
  const s = storage();
  s.setItem("harbor.favorites.v1.p", JSON.stringify([{ id: "a", type: "movie", name: "Old", poster: "device-art" }]));
  const before = readProfileData(s, "p", { uiLanguage: "en" });
  s.setItem("harbor.favorites.v1.p", JSON.stringify([{ id: "a", type: "movie", name: "Latest", poster: "device-art" }]));
  const patch = applyProfileData(s, "p", { ...before, "settings:uiLanguage": "fr", "favorites:a": { id: "a", type: "movie", name: "Remote" } }, before, { uiLanguage: "de" });
  assert.equal(patch.uiLanguage, "de");
  assert.deepEqual(JSON.parse(s.getItem("harbor.favorites.v1.p")!), [{ id: "a", type: "movie", name: "Latest", poster: "device-art" }]);
});
test("configured addons remain installed and only matching plugin selections change", () => {
  const s = storage();
  const addons = [{ id: "a", transportUrl: "https://a.test/secret/manifest.json" }, { id: "b", transportUrl: "https://b.test/manifest.json" }];
  s.setItem("harbor.installed-addons.p", JSON.stringify(addons));
  const base = readProfileData(s, "p", {});
  applyProfileData(s, "p", { ...base, "addon:a": { enabled: false } }, base, {});
  assert.deepEqual(JSON.parse(s.getItem("harbor.installed-addons.p")!), addons);
  assert.deepEqual(JSON.parse(s.getItem("harbor.addons.disabled.p")!), [addons[0].transportUrl]);
});

test("multiple configurations of one addon keep separate local selections", () => {
  const s = storage();
  const addons = [{ id: "a", transportUrl: "https://a.test/config1/manifest.json" }, { id: "a", transportUrl: "https://a.test/config2/manifest.json" }];
  s.setItem("harbor.installed-addons.p", JSON.stringify(addons));
  s.setItem("harbor.addons.disabled.p", JSON.stringify([addons[1].transportUrl]));
  const base = readProfileData(s, "p", {});
  assert.equal(base["addon:a"], undefined);
  applyProfileData(s, "p", { "addon:a": { enabled: false } }, base, {});
  assert.deepEqual(JSON.parse(s.getItem("harbor.addons.disabled.p")!), [addons[1].transportUrl]);
});

test("unsupported local URL items stay on the device through sync", () => {
  const s = storage();
  const local = { id: "https://private.test/media", type: "movie", name: "Device only" };
  s.setItem("harbor.favorites.v1.p", JSON.stringify([local]));
  const base = readProfileData(s, "p", {});
  assert.deepEqual(base, {});
  applyProfileData(s, "p", {}, base, {});
  assert.deepEqual(JSON.parse(s.getItem("harbor.favorites.v1.p")!), [local]);
});

test("legacy explicitly shared watchlists stay shared while each profile's library stays separate", () => {
  const s = storage();
  s.setItem("harbor.profiles.v1", JSON.stringify({ profiles: [{ id: "parent" }, { id: "child", shareStremioWith: "parent" }] }));
  s.setItem("harbor.watchlist.v1.parent", JSON.stringify([{ id: "shared", name: "Shared", type: "movie" }]));
  s.setItem("harbor.jl.library.v1.parent", JSON.stringify([{ _id: "private-parent", name: "Private", type: "movie" }]));
  const values = readProfileData(s, "child", {});
  assert.ok(values["watchlist:shared"]);
  assert.equal(values["library:private-parent"], undefined);
  applyProfileData(s, "child", values, values, {});
  assert.equal(s.getItem("harbor.watchlist.v1.child"), null);
  assert.equal(JSON.parse(s.getItem("harbor.jl.library.v1.parent")!)[0]._id, "private-parent");
});

test("profile metadata uses explicit safe fields and excludes PIN/avatar/device secrets", () => {
  const values = readProfileData(storage(), "p", {}, { name: "Viewer", color: "#7dd3fc", passwordHash: "private", avatar: "https://token.example" });
  assert.deepEqual(values, { "profile:name": "Viewer", "profile:color": "#7dd3fc" });
  assert.deepEqual(validateProfileData(values), values);
});
test("malformed remote values, extra secret fields and invalid preferences fail closed", () => {
  assert.throws(() => validateProfileData({ "settings:rdKey": "private" }));
  assert.throws(() => validateProfileData({ "settings:uiLanguage": false }));
  assert.throws(() => validateProfileData({ "favorites:a": { id: "a", url: "https://secret" } }));
  assert.throws(() => validateProfileData([]));
});
test("quota failure rolls all local stores back, including keys that did not previously exist", () => {
  const s = storage();
  const save = s.setItem;
  let fail = true;
  s.setItem = (key, value) => { if (fail && key === "harbor.localcw.v1.p") { fail = false; throw new Error("quota"); } save(key, value); };
  assert.throws(() => applyProfileData(s, "p", { "favorites:a": { id: "a", name: "Saved", type: "movie" } }, {}, {}), /quota/);
  assert.equal(s.values.size, 0);
});
test("REST CAS uses the exact server timestamp and preserves other application settings", async () => {
  let patchPath = "", patch: unknown;
  const stamp = "2026-10-09T12:00:00.123456+00:00";
  const remote = createProfileDocumentRemote(async (path, init) => {
    if (init?.method === "PATCH") { patchPath = path; patch = JSON.parse(String(init.body)); return new Response('[{"id":"p"}]'); }
    return new Response(JSON.stringify([{ id: "p", owner: "a", name: "Viewer", settings: { other_app: { enabled: true } }, updated_at: stamp }]));
  }, "p", "a");
  const state = await remote.pull();
  assert.equal(await remote.compareAndSwap(state, { "settings:uiLanguage": "en" }), true);
  assert.equal(new URLSearchParams(patchPath.split("?")[1]).get("updated_at"), `eq.${stamp}`);
  assert.deepEqual(patch, { settings: { other_app: { enabled: true }, jl_harbor_v1: { revision: 1, values: { "settings:uiLanguage": "en" } } } });
  assert.ok(patchPath.length < 180);
});
test("REST rejects a profile belonging to another account and malformed success bodies", async () => {
  const remote = createProfileDocumentRemote(async () => new Response(JSON.stringify([{ id: "p", owner: "wrong", settings: {}, updated_at: "2026-01-01" }])), "p", "a");
  await assert.rejects(remote.pull(), /Invalid/);
});
test("sports favorites retain the old baseline on a partially failed push", async () => {
  let checkpoint = false;
  const row = { kind: "team" as const, item_id: "NFL:1", meta: { name: "Team" } };
  await assert.rejects(syncFavoriteRows({ assertCurrent: () => {}, readBase: () => [], writeBase: () => { checkpoint = true; }, readLocal: () => [row], writeLocal: () => {}, pull: async () => [], push: async () => { throw new Error("offline"); } }), /offline/);
  assert.equal(checkpoint, false);
});
