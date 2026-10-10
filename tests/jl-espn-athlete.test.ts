import assert from "node:assert/strict";
import test from "node:test";
import { parseAthlete, parseGameLog, withTeamDetails } from "../src/lib/jl/sports/espn-athlete.ts";

test("athlete profile: bio, season stats, team and what Follow stores", () => {
  const a = parseAthlete({
    athlete: {
      id: "3139477",
      displayName: "Patrick Mahomes",
      headshot: { href: "http://a/pm.png" },
      position: { displayName: "Quarterback", abbreviation: "QB" },
      displayJersey: "#15",
      team: { id: "12", displayName: "Kansas City Chiefs", logos: [{ href: "https://a/kc.png" }], color: "e31837" },
      displayHeight: "6' 2\"",
      displayWeight: "225 lbs",
      age: 31,
      college: { name: "Texas Tech" },
      statsSummary: {
        displayName: "2026 Regular Season",
        statistics: [
          { displayName: "Passing Yards", displayValue: "3,210", rankDisplayValue: "3rd" },
          { displayName: "Bad", displayValue: "" },
        ],
      },
    },
  });
  if (!a) throw new Error("athlete expected");
  assert.equal(a.name, "Patrick Mahomes");
  assert.equal(a.headshot, "https://a/pm.png");
  assert.equal(a.position, "Quarterback");
  assert.equal(a.jersey, "#15");
  assert.deepEqual(a.team, { id: "12", name: "Kansas City Chiefs", logo: "https://a/kc.png", color: "e31837" });
  assert.deepEqual(a.bio, [
    { label: "Height, weight", value: "6' 2\", 225 lbs" },
    { label: "Age", value: "31" },
    { label: "College", value: "Texas Tech" },
  ]);
  assert.equal(a.statsLabel, "2026 Regular Season");
  assert.deepEqual(a.stats, [{ label: "Passing Yards", value: "3,210", rank: "3rd" }]);
  assert.deepEqual(a.follow, { teamId: "12", teamName: "Kansas City Chiefs", headshot: "https://a/pm.png", position: "QB" });
  assert.equal(parseAthlete({}), null);
});

test("game log rows, newest first, each with a game to open", () => {
  const log = parseGameLog(
    {
      labels: ["CMP", "YDS"],
      events: {
        "401": {
          id: "401",
          gameDate: "2026-09-10T00:20Z",
          atVs: "vs",
          gameResult: "W",
          score: "27-20",
          homeTeamId: "12",
          awayTeamId: "33",
          homeTeamScore: "27",
          awayTeamScore: "20",
          team: { id: "12", abbreviation: "KC" },
          opponent: { id: "33", displayName: "Baltimore Ravens", abbreviation: "BAL", logo: "http://a/bal.png" },
        },
        "402": {
          id: "402",
          gameDate: "2026-09-17T00:20Z",
          atVs: "@",
          gameResult: "L",
          homeTeamId: "4",
          homeTeamScore: "30",
          awayTeamScore: "10",
          team: { id: "12", abbreviation: "KC" },
          opponent: { id: "4", abbreviation: "CIN" },
        },
      },
      seasonTypes: [
        {
          displayName: "2026 Regular Season",
          categories: [
            { events: [{ eventId: "401", stats: ["20", "250"] }] },
            { events: [{ eventId: "402", stats: ["18", "190"] }, { eventId: "401", stats: ["x"] }] },
          ],
        },
      ],
    },
    "NFL",
  );
  assert.equal(log.label, "2026 Regular Season");
  assert.deepEqual(log.columns, ["CMP", "YDS"]);
  assert.deepEqual(log.rows.map((r) => [r.eventId, r.atVs, r.opponent.abbr, r.result, r.stats]), [
    ["402", "@", "CIN", "L", ["18", "190"]],
    ["401", "vs", "BAL", "W", ["20", "250"]],
  ]);
  const won = log.rows[1].game;
  if (!won) throw new Error("game expected");
  assert.equal(won.league, "NFL");
  assert.equal(won.state, "post");
  assert.deepEqual([won.home.id, won.home.score, won.home.winner, won.away.id, won.away.score], ["12", "27", true, "33", "20"]);
  const lost = log.rows[0].game;
  if (!lost) throw new Error("game expected");
  assert.deepEqual([lost.home.id, lost.home.winner, lost.away.id, lost.away.score], ["4", true, "12", "10"]);

  const filled = withTeamDetails(won, { id: "12", name: "Kansas City Chiefs", logo: "https://a/kc.png" });
  assert.equal(filled.home.name, "Kansas City Chiefs");
  assert.equal(filled.home.logo, "https://a/kc.png");
  assert.equal(filled.away.name, "Baltimore Ravens");

  assert.deepEqual(parseGameLog(null, "NFL"), { label: null, columns: [], rows: [] });
});
