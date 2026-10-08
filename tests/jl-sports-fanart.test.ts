// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  ART_HIT_TTL_MS,
  chooseGameArt,
  createTeamArtCache,
  parseArtCache,
  pickTeamArt,
  stableIndex,
  teamSearchUrl,
  trimArtCache,
} from "../src/lib/jl/sports/fanart.ts";

const IMG = "https://img.example/";

const teams = [
  { idESPN: "9", strTeam: "Golden State Warriors", strSport: "Basketball", strFanart1: `${IMG}gsw1.jpg`, strFanart2: `http://img.example/gsw2.jpg` },
  { idESPN: "", strTeam: "Warriors", strSport: "Rugby", strFanart1: `${IMG}rugby.jpg` },
  { idESPN: "", strTeam: "Kansas City Chiefs", strSport: "American Football", strBanner: `${IMG}kc-banner.jpg` },
];

test("teams match by ESPN id first, then by name in the same sport", () => {
  const gsw = pickTeamArt(teams, { id: "9", name: "Warriors" }, "NBA");
  assert.deepEqual(gsw?.fanart, [`${IMG}gsw1.jpg`, "https://img.example/gsw2.jpg"]);
  // Same nickname in another sport is never picked.
  assert.equal(pickTeamArt(teams, { id: "1", name: "Warriors" }, "NBA"), null);
  const kc = pickTeamArt(teams, { id: "12", name: "Kansas City Chiefs" }, "NFL");
  assert.deepEqual(kc, { fanart: [], banner: `${IMG}kc-banner.jpg` });
  assert.equal(pickTeamArt(null, { id: "9", name: "x" }, "NBA"), null);
});

test("game art prefers the home team's fan art and stays stable per game", () => {
  const home = { fanart: ["a", "b", "c"], banner: "hb" };
  const away = { fanart: ["z"], banner: null };
  const first = chooseGameArt({ id: "401" }, home, away);
  assert.equal(chooseGameArt({ id: "401" }, home, away), first);
  assert.ok(home.fanart.includes(first ?? ""));
  assert.equal(chooseGameArt({ id: "1" }, { fanart: [], banner: "hb" }, away), "z");
  assert.equal(chooseGameArt({ id: "1" }, { fanart: [], banner: "hb" }, null), "hb");
  assert.equal(chooseGameArt({ id: "1" }, null, null), null);
  assert.equal(stableIndex("x", 0), 0);
});

test("search URLs refuse unsafe keys", () => {
  assert.equal(teamSearchUrl("a/b", "Chiefs"), null);
  assert.match(teamSearchUrl("abc", "Kansas City Chiefs") ?? "", /searchteams\.php\?t=Kansas%20City%20Chiefs$/);
});

test("stored cache drops expired and malformed entries and is capped", () => {
  const raw = JSON.stringify({
    fresh: { art: { fanart: ["u", 3], banner: null }, expires: 200 },
    miss: { art: null, expires: 200 },
    old: { art: null, expires: 50 },
    bad: { art: "x", expires: 200 },
  });
  const rec = parseArtCache(raw, 100);
  assert.deepEqual(Object.keys(rec).sort(), ["fresh", "miss"]);
  assert.deepEqual(rec.fresh.art?.fanart, ["u"]);
  assert.deepEqual(parseArtCache("{nope", 0), {});
  const big = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, { art: null, expires: i }]));
  assert.deepEqual(Object.keys(trimArtCache(big, 2)).sort(), ["k3", "k4"]);
});

test("cache dedupes, spaces requests, and persists answers", async () => {
  let clock = 1000;
  const urls: string[] = [];
  const slept: number[] = [];
  const store = new Map<string, string>();
  const cache = createTeamArtCache({
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    spacingMs: 2000,
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    fetchJson: async (url) => {
      urls.push(url);
      return { status: 200, json: { teams } };
    },
  });
  const side = { id: "9", name: "Golden State Warriors" };
  const [a, b] = await Promise.all([cache.request("key", "NBA", side), cache.request("key", "NBA", side)]);
  assert.equal(urls.length, 1);
  assert.equal(a, b);
  assert.equal(cache.get("NBA:9")?.fanart.length, 2);
  await cache.request("key", "NFL", { id: "12", name: "Kansas City Chiefs" });
  assert.equal(urls.length, 2);
  assert.deepEqual(slept, [2000]);
  const stored = parseArtCache(store.get("jl.sports.teamArt.v1") ?? null, clock);
  assert.ok(stored["NBA:9"].expires >= clock + ART_HIT_TTL_MS - 5000);
  // Cached answers need no request.
  await cache.request("key", "NBA", side);
  assert.equal(urls.length, 2);
});

test("failed requests are retried later instead of cached as no art", async () => {
  let clock = 0;
  const cache = createTeamArtCache({
    now: () => clock,
    sleep: async () => {},
    storage: null,
    fetchJson: async () => ({ status: 429, json: null }),
  });
  await cache.request("key", "NBA", { id: "9", name: "Warriors" });
  assert.equal(cache.get("NBA:9"), null);
  clock += 11 * 60_000;
  assert.equal(cache.get("NBA:9"), undefined);
});
