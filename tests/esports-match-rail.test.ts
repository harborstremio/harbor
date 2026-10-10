import test from "node:test";
import assert from "node:assert/strict";
import {
  esportsRailMatches,
  esportsRailGames,
  selectedEsportsFeeds,
} from "../src/lib/sports/esports-match-rail.ts";
import type { EsportsFeed, EsportsMatch } from "../src/lib/sports/esports-feeds.ts";

const now = Date.UTC(2026, 8, 14, 12);
const match = (
  id: string,
  state: EsportsMatch["state"] = "upcoming",
  game: EsportsMatch["game"] = "cs2",
): EsportsMatch => ({
  id,
  game,
  state,
  startMs: now + (state === "upcoming" ? 3600000 : -3600000),
  event: { id: "event", name: "Tournament" },
  teams: [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
  ],
  streams: [],
  sourceUrl: "https://example.com/match",
});
const feed = (
  matches: EsportsMatch[],
  status: EsportsFeed["status"] = "ready",
  fetchedAt = now,
): EsportsFeed => ({
  game: "cs2",
  matches,
  status,
  fetchedAt,
  source: { name: "Fixture", url: "https://example.com" },
});

test("fresh live matches lead; stale or unavailable feeds cannot claim live", () => {
  assert.deepEqual(
    esportsRailMatches([feed([match("next"), match("live", "live")])], now).map((m) => m.id),
    ["live", "next"],
  );
  for (const f of [
    feed([match("live", "live")], "stale"),
    feed([match("live", "live")], "ready", now - 180001),
  ])
    assert.equal(esportsRailMatches([f], now).length, 0);
});
test("upcoming selection leaves room for other games and deduplicates matches", () => {
  const cs = Array.from({ length: 20 }, (_, i) => match(`cs${i}`));
  const lol = match("lol", "upcoming", "lol");
  const result = esportsRailMatches([feed([...cs, lol, cs[0]])], now);
  assert.equal(result.length, 12);
  assert.equal(new Set(result.map((m) => m.id)).size, 12);
  assert.ok(result.slice(0, 4).some((m) => m.game === "lol"));
});
test("recent results appear only when there are no live or upcoming matches", () => {
  assert.deepEqual(
    esportsRailMatches([feed([match("done", "recent"), match("next")])], now).map((m) => m.id),
    ["next"],
  );
  assert.equal(esportsRailMatches([feed([match("done", "recent")])], now)[0].state, "recent");
});

test("selected leagues request only relevant games; explicit empty selection stays empty", () => {
  assert.equal(esportsRailGames(), undefined);
  assert.deepEqual(esportsRailGames([]), []);
  assert.deepEqual(esportsRailGames(["NBA", "LCK", "LEC", "RLCS"]), ["lol", "rocketleague"]);
});
test("LoL choices exclude other leagues and challengers before the card limit", () => {
  const lol = (name: string) => ({
    ...match(name, "upcoming", "lol"),
    event: { id: name, name: name + " · Playoffs" },
  });
  const feeds = [
    { ...feed([lol("LEC"), lol("LCK"), lol("LCK Challengers"), lol("LPL")]), game: "lol" as const },
    feed([match("cs")]),
  ];
  assert.deepEqual(
    selectedEsportsFeeds(feeds, ["LCK"])[0].matches.map((m) => m.id),
    ["LCK"],
  );
  assert.equal(selectedEsportsFeeds(feeds, ["LCK"]).length, 1);
  assert.deepEqual(selectedEsportsFeeds(feeds, []), []);
  assert.equal(selectedEsportsFeeds(feeds), feeds);
});
