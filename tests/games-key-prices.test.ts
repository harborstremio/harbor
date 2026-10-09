import test from "node:test";
import assert from "node:assert/strict";
import { externalKeyComparison, filterPriceOffers, parsePriceOffers, parsePriceStores, reportedSteamDeals } from "../src/lib/games/key-price-data.ts";
import { KEY_SHOPS, filterKeyShops, keyShopUrl } from "../src/lib/games/key-shops.ts";

const stores = parsePriceStores([
  { storeID: "1", storeName: "Steam", isActive: 1, images: { icon: "/img/stores/icons/0.png" } },
  { storeID: "3", storeName: "GreenManGaming", isActive: 1, images: { icon: "/img/stores/icons/2.png" } },
  { storeID: "4", storeName: "Inactive", isActive: 0 },
]);
const offer = (fields = {}) => ({ steamAppID: "1174180", title: "Red Dead Redemption 2", storeID: "3", dealID: "abcdefghijklmnop%2B%2F%3D", salePrice: "19.99", normalPrice: "59.99", ...fields });

test("directory finds requested marketplaces without representing their listings as live prices", () => {
 assert.equal(filterKeyShops('lztmarket','all')[0]?.id,'lzt');
 assert.equal(filterKeyShops('CDKeys','keys')[0]?.id,'loaded');
 assert.deepEqual(filterKeyShops('','marketplace').map(shop=>shop.id),['g2g','eldorado','lzt']);
 for(const shop of KEY_SHOPS){ assert.equal(new URL(keyShopUrl(shop,620)).protocol,'https:'); assert.equal('price' in shop,false); }
});

test("prices join only exact Steam identities and active known stores", () => {
  assert.equal(parsePriceOffers([offer({ steamAppID: "1174181" }), offer({ storeID: "4" }), offer({ storeID: "888" }), offer()], 1174180, stores).length, 1);
  assert.throws(() => externalKeyComparison(-1));
  assert.equal(externalKeyComparison(1174180), "https://gg.deals/steam/app/1174180/");
});
test("price and redirect parsing rejects malformed values without manufacturing free offers", () => {
  for (const salePrice of ["", null, "NaN", "-5", "2.999", "1e3", "0x10", 9]) assert.equal(parsePriceOffers([offer({ salePrice })], 1174180, stores).length, 0);
  const parsed = parsePriceOffers([offer({ salePrice: "0.00" })], 1174180, stores)[0]!;
  assert.equal(parsed.amount, 0);
  assert.equal(new URL(parsed.url).searchParams.get("dealID"), "abcdefghijklmnop+/=");
  assert.equal(parsePriceOffers([offer({ dealID: "https://evil.example" })], 1174180, stores).length, 0);
});
test("matching a Steam game does not invent activation platform or region", () => {
  const unknown = parsePriceOffers([offer()], 1174180, stores)[0]!;
  assert.equal(unknown.activation, "unknown"); assert.equal(unknown.region, "unknown");
  assert.equal(filterPriceOffers([unknown], "all", "steam").length, 0);
  const reported = reportedSteamDeals([offer(), offer({ steamAppID: "2", dealID: "differentabcdefghijklmnop" })], 1174180);
  const verified = parsePriceOffers([offer()], 1174180, stores, reported)[0]!;
  assert.equal(verified.activation, "reported-steam"); assert.equal(verified.region, "unknown");
  assert.equal(parsePriceOffers([offer({ storeID: "1" })], 1174180, stores)[0]!.activation, "steam");
});
test("filters preserve ascending prices, meaningful zero prices and provider links", () => {
  const offers = parsePriceOffers([offer(), offer({ storeID: "1", dealID: "steamabcdefghijklmnop", salePrice: "0.00" }), offer()], 1174180, stores);
  assert.equal(offers.length, 2); assert.deepEqual(offers.map(o => o.amount), [0, 1999]);
  assert.equal(filterPriceOffers(offers, "3", "all")[0]!.store.name, "GreenManGaming");
  assert.equal(filterPriceOffers(offers, "3", "steam").length, 0);
  assert.ok(offers.every(o => o.url.startsWith("https://www.cheapshark.com/redirect?dealID=")));
});
