import test from "node:test";
import assert from "node:assert/strict";
import {
  sportsAddonCatalogs,
  sportsAddonRequests,
  sportsAddonCatalogUrl,
  sportsAddonListings,
  mergeSportsAddonListings,
} from "../src/lib/sports/addon-sources-model.ts";
import type { Addon } from "../src/lib/addons.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";
const game: SportsGame = {
  id: "espn:123",
  league: "EPL",
  state: "in",
  startMs: Date.parse("2026-09-14T18:00:00Z"),
  detail: "",
  broadcasts: ["ESPN"],
  home: { id: "1", name: "São Paulo", abbr: "SAO", logo: "", score: "", winner: false },
  away: { id: "2", name: "River Plate", abbr: "RIV", logo: "", score: "", winner: false },
};
const addon: Addon = {
  transportUrl: "https://addon.test/config/manifest.json",
  manifest: {
    id: "sports-addon",
    name: "Sport Streams",
    resources: ["catalog", "stream"],
    types: ["sports"],
    catalogs: [{ id: "live-events", type: "sports", name: "Events" }],
  },
};
const catalog = addon.manifest.catalogs![0];
test("sports discovery includes custom event types and excludes unrelated/adult addons", () => {
  assert.equal(sportsAddonCatalogs(addon).length, 1);
  assert.equal(
    sportsAddonCatalogs({
      ...addon,
      manifest: { ...addon.manifest, behaviorHints: { adult: true } },
    }).length,
    0,
  );
  assert.equal(
    sportsAddonCatalogs({
      ...addon,
      manifest: {
        id: "films",
        name: "Films",
        catalogs: [{ id: "popular", name: "Popular", type: "movie" }],
      },
    }).length,
    0,
  );
});
test("both search manifest forms, required extras, and original custom IDs are preserved", () => {
  for (const legacy of [false, true]) {
    const custom = {
      ...addon,
      manifest: {
        ...addon.manifest,
        catalogs: [
          {
            ...catalog,
            id: "events/one",
            extra: [
              { name: "genre", isRequired: true, options: ["Sports"] },
              ...(legacy ? [] : [{ name: "search", isRequired: true }]),
            ],
            ...(legacy ? { extraSupported: ["search"] } : {}),
          },
        ],
      },
    };
    const requests = sportsAddonRequests([custom], game);
    assert.equal(requests.length, 2);
    const url = sportsAddonCatalogUrl(requests[0]);
    assert.match(url, /catalog\/sports\/events%2Fone\/genre=Sports&search=S%C3%A3o%20Paulo\.json$/);
    assert.equal(url.includes(game.id), false);
  }
});
test("event matching tolerates accents, reversed teams and exact codes, without accepting replays or one-team guesses", () => {
  const names = [
    "River Plate vs Sao Paulo",
    "RIV - SAO",
    "Sao Paulo vs Flamengo",
    "River Plate vs Sao Paulo replay",
    "River Plate vs Sao Paulo 2025-09-14",
    "ESPN HD",
  ];
  const rows = sportsAddonListings(
    addon,
    catalog,
    names.map((name, i) => ({ id: `native:${i}`, name, type: i === 5 ? "tv" : "sports" })),
    game,
  );
  assert.deepEqual(
    rows.map((row) => row.match),
    ["event", "event", null, null, null, "channel"],
  );
  assert.equal(rows[0].meta.id, "native:0");
  assert.equal(rows[0].meta.type, "sports");
  assert.equal(rows[0].meta.addonOrigin?.base, "https://addon.test/config");
});
test("duplicate catalog entries collapse but distinct installed configurations do not", () => {
  const raw = [{ id: "native:fixture", name: "River Plate vs Sao Paulo" }];
  const first = sportsAddonListings(addon, catalog, raw, game);
  const second = sportsAddonListings(
    { ...addon, transportUrl: "https://addon.test/other/manifest.json" },
    catalog,
    raw,
    game,
  );
  assert.equal(mergeSportsAddonListings([...first, ...first, ...second]).length, 2);
});
test("Sports Streams channel naming and per-sport catalogs use the existing Live TV conventions", () => {
  const row = sportsAddonListings(
    addon,
    catalog,
    [{ id: "leaf:us-espn-hd-23993", type: "sport", name: "US : ESPN" }],
    game,
  )[0];
  assert.equal(row.match, "channel");
  const scoped = {
    ...addon,
    manifest: {
      ...addon.manifest,
      catalogs: ["Live Now", "Today", "Football", "American Football", "Basketball", "Tennis"].map(
        (name) => ({ id: name, type: "sport", name }),
      ),
    },
  };
  assert.deepEqual(
    sportsAddonRequests([scoped], game, "soccer").map((r) => r.catalog.name),
    ["Live Now", "Today", "Football"],
  );
});
test("numbered fights reject the wrong card and catalog request fanout is bounded", () => {
  const fight = {
    ...game,
    context: {
      id: "331",
      name: "UFC 331: Van vs Pantoja",
      round: "",
      draw: "",
      venue: "",
      major: true,
    },
  };
  const rows = sportsAddonListings(
    addon,
    catalog,
    [
      { id: "one", name: "UFC 331" },
      { id: "two", name: "UFC 330" },
    ],
    fight,
  );
  assert.deepEqual(
    rows.map((row) => row.match),
    ["event", null],
  );
  const many = Array.from({ length: 60 }, (_, i) => ({
    ...addon,
    transportUrl: `https://addon${i}.test/manifest.json`,
  }));
  assert.equal(sportsAddonRequests(many, game).length, 32);
});
