import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function fixture(
  fetcher: (url: string, init?: RequestInit) => Promise<Response> = async () => new Response(""),
) {
  const output = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/artist-extras.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(
    () => ({ safeFetchBytes: fetcher }),
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/lib/music/artist-extras");
}
const profile = {
  id: "056e4f3e-d505-4dad-8ec1-d04f521cbb56",
  name: "Daft Punk",
  aliases: [],
  genres: [],
  members: [],
  sources: [],
  links: [
    { url: "https://shop.example.com/", kind: "merch" as const, name: "Store" },
    {
      url: "https://artist.example.com/",
      kind: "official" as const,
      name: "Official",
    },
  ],
};
const ld = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const product = {
  "@type": "Product",
  name: "Daft Punk shirt",
  image: "/shirt.png",
  url: "/products/shirt",
  offers: {
    price: "35.00",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};
const event = {
  "@type": "MusicEvent",
  name: "Evening show",
  performer: { name: "Daft Punk" },
  startDate: "2028-06-10T20:00:00+01:00",
  location: { name: "Venue", address: { addressLocality: "Paris" } },
  url: "https://tickets.example.com/show",
};

test("public product/event data stays artist-specific, future and actionable", () => {
  const api = fixture();
  const value = api.parseArtistExtraPage(
    ld({
      "@graph": [
        product,
        event,
        { ...event, name: "Unrelated", performer: { name: "Other artist" } },
        { ...event, startDate: "2020-01-01" },
        { ...event, eventStatus: "https://schema.org/EventCancelled" },
        { ...event, startDate: "2028-02-30" },
        { ...product, name: "Other shirt" },
      ],
    }),
    "https://shop.example.com/",
    profile,
    Date.parse("2027-01-01"),
  );
  assert.equal(value.products.length, 1);
  assert.equal(value.products[0].price, 35);
  assert.equal(value.products[0].image, "https://shop.example.com/shirt.png");
  assert.equal(value.events.length, 1);
  assert.equal(value.events[0].venue, "Venue");
  for (const url of [
    "javascript:alert(1)",
    "file:///C:/private",
    "https://127.0.0.1/x",
    "https://192.168.1.1/x",
    "https://x.local/x",
    "https://user:pass@example.com/x",
    "http://[::1]/",
  ])
    assert.equal(api.artistExtraUrl(url), null);
  assert.equal(
    api.parseArtistExtraPage(
      ld({ ...product, image: "javascript:bad" }),
      "https://shop.example.com/",
      profile,
    ).products.length,
    0,
  );
});

test("only observed same-origin tour links and genuine Shopify markers enable follow-up", () => {
  const api = fixture();
  const html = `<title>Daft Punk shop</title><a href="/tour?x=1&amp;y=2">Tour dates</a><a href="https://other.example.com/tour">Tour</a><script>Shopify.shop = "daft.myshopify.com"; Shopify.currency = {"active":"USD"};</script><script src="https://cdn.shopify.com/theme.js"></script>`;
  const page = api.parseArtistExtraPage(html, "https://shop.example.com/", profile);
  assert.deepEqual(page.tourLinks, ["https://shop.example.com/tour?x=1&y=2"]);
  assert.equal(page.shopify, true);
  assert.equal(page.currency, "USD");
  assert.equal(
    api.parseArtistExtraPage("Shopify is mentioned in text", "https://shop.example.com/", profile)
      .shopify,
    false,
  );
  const base = {
    title: "Daft Punk shirt",
    handle: "shirt",
    vendor: "Daft Punk",
    images: [{ src: "https://cdn.shopify.com/shirt.png" }],
    variants: [
      { available: true, price: "30" },
      { available: true, price: "40" },
    ],
  };
  const products = api.parseArtistShopify(
    {
      products: [
        base,
        { ...base, title: "Other", vendor: "Other" },
        { ...base, variants: [{ available: false, price: "30" }] },
      ],
    },
    "https://shop.example.com/",
    "Daft Punk",
    false,
    "USD",
  );
  assert.equal(products.length, 1);
  assert.equal(products[0].price, undefined);
  assert.equal(products[0].url, "https://shop.example.com/products/shirt");
});

test("loader caps requests, caches results and never probes a guessed tour/feed", async () => {
  const calls: string[] = [];
  const api = fixture(async (url) => {
    calls.push(url);
    return new Response(
      url.includes("tour")
        ? ld(event)
        : `<title>Daft Punk</title>${ld(product)}<a href="/tour">Tour</a>`,
    );
  });
  const first = await api.loadArtistExtras(profile);
  assert.equal(first.products.length, 2);
  assert.equal(first.events.length, 1);
  assert.ok(calls.length <= 4);
  assert.equal(
    calls.some((url) => url.includes("products.json")),
    false,
  );
  const count = calls.length;
  await api.loadArtistExtras(profile);
  assert.equal(calls.length, count);
  const noData = await fixture(async () => new Response("no structured data")).loadArtistExtras(
    profile,
  );
  assert.equal(noData.events.length, 0);
  assert.equal(noData.products.length, 0);
  assert.equal(
    noData.links.some((link) => link.kind === "tour"),
    false,
  );
});

test("oversized responses fall back to verified links and aborted work does not publish a cache", async () => {
  const bounded = await fixture(
    async () => new Response("too large", { headers: { "content-length": "9000000" } }),
  ).loadArtistExtras(profile);
  assert.equal(bounded.products.length, 0);
  assert.equal(bounded.links.length, 2);
  const controller = new AbortController();
  let calls = 0;
  const api = fixture(async () => {
    calls++;
    controller.abort();
    return new Response(ld(product));
  });
  await assert.rejects(api.loadArtistExtras(profile, controller.signal));
  assert.equal(calls, 1);
});
