import assert from "node:assert/strict";
import test from "node:test";
import { asBase, asSearchSlug, asSportFor, parseAsEvents, pickAsTeam } from "../src/lib/jl/sports/as-team-games.ts";

test("sport slugs and paths", () => {
  assert.equal(asSportFor("NFL", "football"), "american-football");
  assert.equal(asSportFor("NCAA", "basketball"), "basketball");
  assert.equal(asSportFor("EPL", "soccer"), "football");
  assert.equal(asSportFor("F1", "motorsport"), null);
  assert.equal(asBase("football"), "/api");
  assert.equal(asBase("ice-hockey"), "/api/ice-hockey");
  assert.equal(asSearchSlug("São Paulo  FC"), "sao-paulo-fc");
});

test("the team hit must have the same name", () => {
  const doc = {
    results: [
      { type: "player", score: 9, entity: { id: 5, name: "Kansas City Chiefs" } },
      { type: "team", score: 1, entity: { id: 7, name: "Kansas City\tChiefs" } },
      { type: "team", score: 5, entity: { id: 8, name: "Kansas City Chiefs" } },
      { type: "team", score: 50, entity: { id: 9, name: "Kansas City Royals" } },
    ],
  };
  assert.equal(pickAsTeam(doc, "Kansas City Chiefs"), 8);
  assert.equal(pickAsTeam(doc, "Nobody"), null);
  assert.equal(pickAsTeam(null, "x"), null);
});

test("events with state, scores and league", () => {
  const games = parseAsEvents({
    events: [
      {
        id: 11,
        startTimestamp: 1800000000,
        status: { type: "finished" },
        homeTeam: { name: "Home" },
        awayTeam: { name: "Away" },
        homeScore: { current: 21 },
        awayScore: { current: 14 },
        tournament: { uniqueTournament: { name: "NFL" } },
      },
      { id: 12, status: { type: "notstarted" }, homeTeam: { name: "A" }, awayTeam: { name: "B" } },
      { id: "bad", homeTeam: { name: "A" }, awayTeam: { name: "B" } },
    ],
  });
  assert.deepEqual(games, [
    { id: "11", state: "post", startMs: 1800000000000, home: "Home", away: "Away", homeScore: "21", awayScore: "14", league: "NFL" },
    { id: "12", state: "pre", startMs: 0, home: "A", away: "B", homeScore: null, awayScore: null, league: "" },
  ]);
});
