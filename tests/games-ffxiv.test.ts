import assert from "node:assert/strict";
import test from "node:test";
import { XIV_SCHEMA, isFfxiv, parseXivCenters, parseXivMarket, parseXivSearch, xivMarketUrl, xivSearchUrl } from "../src/lib/games/ffxiv-data.ts";

const now = Date.UTC(2026, 9, 2, 12), center = { name: "Aether", region: "North-America", worlds: [{ id: 57, name: "Siren" }, { id: 54, name: "Faerie" }] };
const item = (id = 5121) => ({ sheet: "Item", row_id: id, fields: { Name: "Darksteel Ore", Description: "Ore", IsUntradable: false, ItemSearchCategory: { row_id: 48, fields: { Name: "Stone" } }, Icon: { path_hr1: "ui/icon/021000/021205_hr1.tex" } } });
const search = () => ({ schema: XIV_SCHEMA, version: "541c0c12e07da325", next: "02fc36e1-2f9a-46ef-8f12-3d20fd26954f", results: [item()] });
const listing = () => ({ worldID: 57, pricePerUnit: 529, quantity: 15, total: 7935, tax: 396, hq: false, lastReviewTime: now / 1000 - 100 });
const market = () => ({ itemID: 5121, dcName: "Aether", lastUploadTime: now - 2000, listings: [listing()], recentHistory: [{ ...listing(), timestamp: now / 1000 - 3600 }] });

test("FFXIV companion is exact-game scoped, and search strings cannot change its query", () => {
  assert.equal(isFfxiv({ steamId: 39210 }), true); assert.equal(isFfxiv({ igdbId: 386 }), true); assert.equal(isFfxiv({ steamId: 999, igdbId: 386 }), false);
  const query = 'Ore" -IsUntradable=false';
  const url = new URL(xivSearchUrl(query, "ar"));
  assert.equal(url.searchParams.get("query"), `+Name~${JSON.stringify(query)} +IsUntradable=false +ItemSearchCategory>0`);
  assert.equal(url.searchParams.get("language"), "en"); assert.equal(url.searchParams.get("schema"), XIV_SCHEMA);
  assert.throws(() => xivSearchUrl("a", "en", "../../etc"));
});
test("item catalog keeps exact sheet identity, schema/version and original bounded asset paths", () => {
  const parsed = parseXivSearch(search()); assert.equal(parsed.items[0].id, 5121); assert.match(parsed.items[0].icon, /version=541c0c12e07da325/);
  assert.throws(() => parseXivSearch(search(), "0000000000000000")); assert.throws(() => parseXivSearch({ ...search(), schema: "unknown" }));
  assert.throws(() => parseXivSearch({ ...search(), results: [{ ...item(), sheet: "Action" }] }));
  assert.equal(parseXivSearch({ ...search(), results: [item(), item()] }).partial, true);
  const bad = item(); bad.fields.Icon.path_hr1 = "https://bad.test/icon.png"; assert.equal(parseXivSearch({ ...search(), results: [bad] }).items[0].icon, "");
});
test("world directory rejects duplicate, unknown and unbound world IDs", () => {
  const dcs = [{ name: "Aether", region: "North-America", worlds: [57, 54] }];
  assert.deepEqual(parseXivCenters(dcs, center.worlds), [center]);
  assert.throws(() => parseXivCenters(dcs, [center.worlds[0]]));
  assert.throws(() => parseXivCenters([...dcs, ...dcs], center.worlds));
  assert.throws(() => xivMarketUrl(center, 5121, 999, "all"));
  assert.equal(new URL(xivMarketUrl(center, 5121, null, "hq")).searchParams.get("hq"), "true");
  assert.doesNotMatch(new URL(xivMarketUrl(center, 5121, null, "all")).searchParams.get("fields")!, /retainer|buyer|creator|seller/i);
});
test("market rows preserve quantity, observed timestamps, quality and exact data-center identity", () => {
  const parsed = parseXivMarket(market(), center, 5121, null, "all", now);
  assert.equal(parsed.listings[0].total, 7935); assert.equal(parsed.listings[0].at, now - 100000); assert.equal(parsed.sales[0].at, now - 3600000);
  assert.throws(() => parseXivMarket({ ...market(), itemID: 2 }, center, 5121, null, "all", now));
  assert.throws(() => parseXivMarket({ ...market(), dcName: "Chaos" }, center, 5121, null, "all", now));
  assert.throws(() => parseXivMarket(market(), center, 5121, null, "hq", now));
  assert.throws(() => parseXivMarket({ ...market(), listings: [{ ...listing(), worldID: 999 }] }, center, 5121, null, "all", now));
  assert.throws(() => parseXivMarket({ ...market(), listings: [{ ...listing(), total: 1 }] }, center, 5121, null, "all", now));
});
test("unknown and invalid timestamps never become fresh data or empty results", () => {
  assert.equal(parseXivMarket({ ...market(), lastUploadTime: null }, center, 5121, null, "all", now).at, null);
  assert.throws(() => parseXivMarket({ ...market(), listings: [{ ...listing(), lastReviewTime: (now + 86400000) / 1000 }] }, center, 5121, null, "all", now));
  assert.equal(parseXivMarket({ ...market(), listings: [], recentHistory: [] }, center, 5121, null, "all", now).listings.length, 0);
  assert.throws(() => parseXivMarket({ ...market(), listings: undefined }, center, 5121, null, "all", now));
});
