import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";
import { createSportsFeedCache, scoreboardEvents } from "../src/lib/jl/sports/feed-cache.ts";
import { heroPhotoCandidates } from "../src/lib/jl/sports/hub-sections.ts";
import { isCurrentLiveGame, sportsSessionKey, visibleScore } from "../src/lib/jl/sports/presentation.ts";
import { detectAlerts, toAlertGame } from "../src/lib/jl/sports/sports-alerts.ts";
import { storySlides, writeStory } from "../src/lib/jl/sports/game-story.ts";
import { interpretKeyTest, testSportsKey } from "../src/lib/jl/sports/sports-keys.ts";

const game = (extra: Partial<SportsGame> = {}): SportsGame => ({
  id: "401000001", league: "NCAAF", state: "pre", detail: "Scheduled", startMs: 1791648000000,
  away: { id: "26", name: "UCLA Bruins", abbr: "UCLA", logo: "", score: "0", winner: false },
  home: { id: "2483", name: "Oregon Ducks", abbr: "ORE", logo: "", score: "0", winner: false },
  ...extra,
});

test("sports story and alert identity isolates both JL accounts and local profiles", () => {
  assert.notEqual(sportsSessionKey("account-a", "main"), sportsSessionKey("account-b", "main"));
  assert.notEqual(sportsSessionKey("account-a", "main"), sportsSessionKey("account-a", "kids"));
  assert.notEqual(sportsSessionKey("a.b", "c"), sportsSessionKey("a", "b.c"));
  assert.equal(sportsSessionKey(null, "main"), '["local","main"]');
});

test("upcoming UCLA/Oregon provider zeroes are hidden; actual live/final zeroes remain", () => {
  for (const state of ["pre", "in", "post"] as const) {
    const fixture = game({ state });
    assert.equal(visibleScore(fixture, fixture.home), state === "pre" ? "" : "0");
    assert.equal(visibleScore(fixture, fixture.away), state === "pre" ? "" : "0");
  }
  const noScore = game({ state: "in" });
  assert.equal(visibleScore(noScore, { score: "" }), "");
});

test("art candidates survive failed remote URLs and end at bundled football scenery", () => {
  const sources = heroPhotoCandidates({
    curated: "/broken-curated.webp", event: "/broken-event.webp", team: "/broken-event.webp",
    league: "  ", bundled: "/sports/hero-photos/football.webp",
  });
  assert.deepEqual(sources, ["/broken-curated.webp", "/broken-event.webp", "/sports/hero-photos/football.webp"]);
  const failed = new Set<string>();
  assert.equal(sources.find((url) => !failed.has(url)), "/broken-curated.webp");
  failed.add(sources[0]);
  assert.equal(sources.find((url) => !failed.has(url)), "/broken-event.webp");
  failed.add(sources[1]);
  assert.equal(sources.find((url) => !failed.has(url)), "/sports/hero-photos/football.webp");
  failed.add(sources[2]);
  assert.equal(sources.find((url) => !failed.has(url)), undefined);
});

test("failed refresh keeps last successful score and original timestamp without mutating it", async () => {
  let now = 1000;
  const cached = createSportsFeedCache(() => now);
  const original = game({ state: "in", detail: "Q1 12:00" });
  const first = await cached("board:NCAAF", async () => ({ games: [original], ttl: 30 }));
  assert.equal(first[0], original);
  now = 1050;
  const fail = async (): Promise<never> => { throw new Error("Synthetic network failure"); };
  const saved = await cached("board:NCAAF", fail);
  assert.equal(saved[0].savedAt, 1000);
  assert.equal(isCurrentLiveGame(saved[0]), false);
  assert.equal(original.savedAt, undefined);
  assert.equal(isCurrentLiveGame(original), true);
  now = 2000;
  assert.equal((await cached("board:NCAAF", fail))[0].savedAt, 1000);
  const fresh = await cached("board:NCAAF", async () => ({ games: [game({ state: "post" })], ttl: 30 }));
  assert.equal(fresh[0].savedAt, undefined);
  assert.equal(fresh[0].state, "post");
});

test("concurrent schedule consumers share one read, TTL applies, valid empty schedules replace old games", async () => {
  let now = 1000;
  let reads = 0;
  const cached = createSportsFeedCache(() => now);
  const load = async () => { reads++; return { games: [game()], ttl: 30 }; };
  const [a, b] = await Promise.all([cached("board:NCAAF", load), cached("board:NCAAF", load)]);
  assert.equal(reads, 1);
  assert.equal(a, b);
  now = 1020;
  await cached("board:NCAAF", load);
  assert.equal(reads, 1);
  now = 1040;
  assert.deepEqual(await cached("board:NCAAF", async () => ({ games: [], ttl: 30 })), []);
});

test("malformed and missing event lists are failures, while a published empty list is valid", async () => {
  for (const body of [null, {}, { error: "Unavailable" }, { events: null }, { events: {} }]) {
    assert.throws(() => scoreboardEvents(body), /unavailable/);
  }
  assert.deepEqual(scoreboardEvents({ events: [] }), []);
  const cached = createSportsFeedCache();
  assert.deepEqual(await cached("new:league", async () => { throw new Error("offline"); }), []);
});

test("saved games and reconnect snapshots cannot generate live or score alerts", () => {
  const options = { mine: true, top: true };
  const pre = toAlertGame(game(), options);
  const live = toAlertGame(game({ state: "in" }), options);
  const saved = toAlertGame(game({ state: "in", savedAt: 1000 }), options);
  assert.equal(detectAlerts([pre], [live])[0]?.kind, "kickoff");
  assert.deepEqual(detectAlerts([pre], [saved]), []);
  assert.deepEqual(detectAlerts([saved], [live]), []);
});

test("saved live stories identify the saved update instead of announcing Live now", () => {
  const fixture = game({ state: "in", detail: "Q1 12:00", savedAt: 1000 });
  const story = writeStory({ game: fixture, summary: null });
  assert.match(story.paragraphs[0], /Last saved update/);
  assert.doesNotMatch(story.paragraphs[0], /Live now|^Live,/);
  assert.equal(storySlides(fixture, null)[0].label, "Saved");
});

test("AllSports key test needs a valid events response and never certifies HTTP error pages", async () => {
  assert.equal(interpretKeyTest("allsports", 200, { events: [] }).ok, true);
  for (const body of [null, "<html>Sign in</html>", { error: "Invalid key" }, {}]) {
    assert.equal(interpretKeyTest("allsports", 200, body).ok, false);
  }
  assert.equal(interpretKeyTest("allsports", 204, null).ok, true);
  assert.doesNotMatch(interpretKeyTest("allsports", 404, null).message, /accepted/);
  assert.doesNotMatch(interpretKeyTest("allsports", 429, null).message, /key works/i);
  let reads = 0;
  const response = await testSportsKey("allsports", "fixture-only", async () => {
    reads++;
    return { status: 200, headers: { get: () => null }, text: async () => "<html>error</html>" };
  });
  assert.equal(reads, 1);
  assert.equal(response.ok, false);
});
