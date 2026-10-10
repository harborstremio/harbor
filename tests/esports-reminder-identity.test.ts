import assert from "node:assert/strict";
import test from "node:test";
import { esportsSportsGame } from "../src/lib/sports/esports-sports-game.ts";
import type { EsportsMatch } from "../src/lib/sports/esports-feeds.ts";

const match: EsportsMatch = {
  id: "match-1", game: "cs2", state: "upcoming", startMs: 1800000000000,
  event: { id: "same-tournament", name: "Championship", stage: "Semi-final" },
  teams: [{ id: "a", name: "Team A" }, { id: "b", name: "Team B" }], streams: [], sourceUrl: "https://example.com",
};
test("two matches in one tournament have independent reminder identities", () => {
  const first = esportsSportsGame(match), second = esportsSportsGame({ ...match, id: "match-2", startMs: match.startMs + 3600000 });
  assert.notEqual(first.context?.id, second.context?.id);
  assert.equal(first.context?.name, "Championship");
  assert.equal(second.startMs, match.startMs + 3600000);
});
test("esports reminder conversion preserves provider state and team identities", () => {
  assert.equal(esportsSportsGame(match).state, "pre");
  assert.equal(esportsSportsGame({ ...match, state: "live" }).state, "in");
  assert.equal(esportsSportsGame({ ...match, state: "recent" }).state, "post");
  assert.equal(esportsSportsGame(match).home.id, "a");
  assert.equal(esportsSportsGame(match).away.id, "b");
});
test("reminders keep their source and game namespaces", () => {
  assert.equal(esportsSportsGame(match).league, "CS2");
  assert.equal(esportsSportsGame(match).source, "esports-arena");
  assert.equal(esportsSportsGame({ ...match, game: "dota2" }).source, "opendota");
  assert.equal(esportsSportsGame({ ...match, game: "dota2" }).league, "DOTA2");
});
