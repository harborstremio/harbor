import assert from "node:assert/strict";
import test from "node:test";
import sample from "./fixtures/games/xbox-audience.json" with { type: "json" };
import { parseXboxAudience, xboxAudienceRequest, XBOX_AUDIENCE_CHANNEL } from "../src/lib/games/xbox-audience.ts";

test("current Xbox API response keeps provider ranks, original art and exact product URLs", () => {
  const games = parseXboxAudience(sample);
  assert.equal(games.length, 25);
  assert.equal(games[0].name, "Fortnite");
  assert.equal(games[0].logo, "/games/publisher/fortnite-logo.svg");
  assert.equal(games[0].sourceUrl, "https://www.xbox.com/en-US/games/store/-/BT5P2X999VH2");
  assert.equal(games.find(game => game.id === "xbox:BQ1TN1T79V9K")?.logo, "/games/publisher/roblox-logo.svg");
  assert.ok(games.some(game => game.name.includes("FC 26") && game.capsule.startsWith("https://store-images.s-microsoft.com/")));
  assert.deepEqual(games.map(game => game.chartRank), Array.from({length:25}, (_,i) => i+1));
  for (const game of games) {
    assert.equal(game.steamId, undefined);
    assert.equal(game.igdbId, undefined);
    assert.equal("currentPlayers" in game, false);
  }
});

test("incomplete products do not shift source ranks, duplicate cards, or use untrusted artwork", () => {
  const raw = structuredClone(sample);
  raw.productSummaries[0].images.superHeroArt.url = "javascript:alert(1)";
  const first = parseXboxAudience(raw)[0];
  assert.equal(first.hero, undefined);
  assert.ok(first.capsule.startsWith("https://store-images.s-microsoft.com/"));
  raw.productSummaries = raw.productSummaries.filter(row => row.productId !== first.id.slice(5));
  raw.channels[XBOX_AUDIENCE_CHANNEL].products.push(raw.channels[XBOX_AUDIENCE_CHANNEL].products[1]);
  const games = parseXboxAudience(raw);
  assert.equal(games[0].chartRank, 2);
  assert.equal(games.length, 24);
  assert.equal(new Set(games.map(game => game.id)).size, games.length);
  assert.throws(() => parseXboxAudience({channels:{}, productSummaries:[]}), /Invalid/);
  assert.throws(() => parseXboxAudience({channels:{[XBOX_AUDIENCE_CHANNEL]:{products:[]}},productSummaries:[]}), /empty/);
});

test("public request uses documented-by-provider version and fresh anonymous correlation vectors", () => {
  const a=xboxAudienceRequest(), b=xboxAudienceRequest();
  assert.equal(a.method,"POST");
  const headers = new Headers(a.headers);
  assert.equal(headers.get("X-MS-API-Version"),"1.1");
  assert.match(headers.get("MS-CV")!, /^[A-Za-z0-9+/]{16}\.0$/);
  assert.notEqual(headers.get("MS-CV"), new Headers(b.headers).get("MS-CV"));
  assert.equal(headers.has("authorization"), false);
  assert.deepEqual(JSON.parse(a.body as string), {ReturnFilters:false,ChannelKeyToBeUsedInResponse:XBOX_AUDIENCE_CHANNEL,ChannelId:"POPULAR"});
});

