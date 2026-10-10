import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWowAddonCategories, parseWowAddonList, selectWowAddonCatalog } from "../src/lib/games/wow-addon-catalog-data.ts";

const row = (id: number, title = `Addon ${id}`) => ({ id, title, author: "Author", categoryId: 2, version: "1", downloads: 100, downloadsMonthly: id, lastUpdate: 1000 + id, gameVersions: ["12.1.0"] });
test("catalog retains unknown versions, rejects invalid identities and reports partial provider records", () => {
  const data = parseWowAddonList([{ ...row(1), gameVersions: ["6.2", "12.1.0"] }, { ...row(2), gameVersions: null, version: null }, row(1), { id: -1, title: "wrong" }]);
  assert.equal(data.partial, true); assert.equal(data.addons.length, 2);
  assert.deepEqual(data.addons[1].gameVersions, []); assert.equal(data.addons[1].version, "");
  assert.deepEqual(data.addons[0].gameVersions, ["6.2", "12.1.0"]);
  assert.equal(data.addons[0].url, "https://www.wowinterface.com/downloads/info1.html");
  assert.throws(() => parseWowAddonList({ error: "unavailable" }));
  assert.throws(() => parseWowAddonList([{ id: "invalid" }]));
  assert.throws(() => parseWowAddonList(Array.from({ length: 20_001 }, () => row(1))));
});
test("provider text remains plain, optional counts stay unknown, and source URLs cannot redirect", () => {
  const item = parseWowAddonList([{ ...row(1, "<b>Addon</b>\u0000"), downloads: -1, downloadsMonthly: null, lastUpdate: Infinity, fileInfoUri: "https://evil.example", gameVersions: ["12.1.0", "12.1.0", "bogus", "1.15.7"] }]).addons[0];
  assert.equal(item.title, "<b>Addon</b>"); assert.equal(item.downloads, null); assert.equal(item.monthlyDownloads, null); assert.equal(item.updatedAt, null);
  assert.deepEqual(item.gameVersions, ["12.1.0", "1.15.7"]); assert.ok(item.url.startsWith("https://www.wowinterface.com/"));
});
test("category icons stay on the observed CDN and parent traversal tolerates cycles", () => {
  const { categories } = parseWowAddonCategories([
    { id: "1", title: "Parent", parentIds: ["0", "2"], iconUrl: "https://cdn-wow.mmoui.com/images/icons/m1.jpg" },
    { id: "2", title: "Child", parentIds: ["1"], iconUrl: "https://evil.example/images/icons/m2.jpg" },
    { id: "3", title: "Other", parentIds: [], iconUrl: "https://cdn-wow.mmoui.com/images/icons/m3.jpg?tracking=1" },
  ]);
  assert.ok(categories[0].icon); assert.equal(categories[1].icon, ""); assert.equal(categories[2].icon, "");
  const { addons } = parseWowAddonList([row(1), { ...row(2), categoryId: 3 }]);
  assert.equal(selectWowAddonCatalog(addons, categories, "", 1, "popular").total, 1);
});
test("full-catalog search ranks exact titles first and pagination does not stop at the first shelf", () => {
  const { addons } = parseWowAddonList([...Array.from({ length: 80 }, (_, n) => row(n + 1)), row(100, "TomTom"), row(101, "TomTom Extra"), { ...row(102, "Different"), author: "TomTom" }]);
  assert.deepEqual(selectWowAddonCatalog(addons, [], "tomtom", null, "popular").addons.map(a => a.id), [100, 101, 102]);
  const initial = selectWowAddonCatalog(addons, [], "", null, "popular");
  const next = selectWowAddonCatalog(addons, [], "", null, "popular", 1);
  assert.equal(initial.total, 83); assert.equal(initial.addons.length, 24); assert.equal(next.addons.length, 24);
  assert.equal(new Set([...initial.addons, ...next.addons].map(a => a.id)).size, 48);
  assert.equal(selectWowAddonCatalog(addons, [], "", null, "popular", 999).addons.length, 11);
  assert.equal(selectWowAddonCatalog(addons, [], "missing", null, "popular", 999).page, 0);
  assert.equal(selectWowAddonCatalog(addons, [], "", null, "updated").addons[0].id, 102);
  assert.equal(selectWowAddonCatalog(addons, [], "Author ADDON 80", null, "name").addons[0].id, 80);
});
