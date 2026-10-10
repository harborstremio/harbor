import assert from "node:assert/strict";
import test from "node:test";
import {
  leadersSource,
  parseRoster,
  parseSummaryLeaders,
  parseTeamInfo,
  resultFor,
  splitSchedule,
} from "../src/lib/jl/sports/espn-team.ts";
import type { SportsGame } from "../src/lib/sports/espn.ts";

test("team header: name, logo, record, standing and colour", () => {
  const info = parseTeamInfo({
    team: {
      id: "12",
      displayName: "Kansas City Chiefs",
      location: "Kansas City",
      name: "Chiefs",
      abbreviation: "KC",
      color: "e31837",
      logos: [{ href: "http://a.espncdn.com/kc.png" }],
      record: { items: [{ type: "home", summary: "5-1" }, { type: "total", summary: "10-3" }] },
      standingSummary: "1st in AFC West",
      franchise: { venue: { fullName: "GEHA Field at Arrowhead Stadium" } },
    },
  });
  assert.deepEqual(info, {
    id: "12",
    name: "Kansas City Chiefs",
    location: "Kansas City",
    nickname: "Chiefs",
    abbr: "KC",
    logo: "https://a.espncdn.com/kc.png",
    color: "e31837",
    record: "10-3",
    standing: "1st in AFC West",
    venue: "GEHA Field at Arrowhead Stadium",
  });
  assert.equal(parseTeamInfo(null), null);
  assert.equal(parseTeamInfo({ team: { id: "1" } }), null);
});

test("rosters grouped by position or flat, with the head coach", () => {
  const grouped = parseRoster({
    athletes: [
      { position: "offense", items: [{ id: "1", displayName: "QB One", jersey: "15", position: { abbreviation: "QB" }, age: 29 }] },
      { position: "defense", items: [{ id: "2", displayName: "LB Two", headshot: { href: "http://h/2.png" } }, { id: "1", displayName: "dup" }] },
    ],
    coach: [{ firstName: "Andy", lastName: "Reid" }],
  });
  assert.equal(grouped.coach, "Andy Reid");
  assert.deepEqual(
    grouped.players.map((p) => [p.id, p.group, p.position, p.jersey, p.headshot, p.detail]),
    [
      ["1", "Offense", "QB", "15", null, "29"],
      ["2", "Defense", null, null, "https://h/2.png", null],
    ],
  );
  const flat = parseRoster({ athletes: [{ id: "9", fullName: "Flat Player" }] });
  assert.deepEqual(flat.players.map((p) => [p.name, p.group]), [["Flat Player", null]]);
  assert.deepEqual(parseRoster(undefined), { players: [], coach: null });
});

test("a team's leaders from a game summary", () => {
  const summary = {
    leaders: [
      {
        team: { id: "12" },
        leaders: [
          {
            displayName: "Passing Yards",
            leaders: [{ displayValue: "3,500 YDS", athlete: { id: "3139477", displayName: "Patrick Mahomes", position: { abbreviation: "QB" } } }],
          },
          { displayName: "Empty", leaders: [] },
        ],
      },
      { team: { id: "7" }, leaders: [{ displayName: "Rushing", leaders: [{ displayValue: "1", athlete: { displayName: "Other" } }] }] },
    ],
  };
  assert.deepEqual(parseSummaryLeaders(summary, "12"), [
    { category: "Passing Yards", athleteId: "3139477", athlete: "Patrick Mahomes", headshot: null, position: "QB", value: "3,500 YDS" },
  ]);
  assert.deepEqual(parseSummaryLeaders({}, "12"), []);
});

const side = (id: string, score = "", winner = false) => ({ id, name: id, abbr: id, logo: "", score, winner });
const game = (id: string, state: SportsGame["state"], startMs: number, home = side("1"), away = side("2")): SportsGame => ({
  id,
  league: "NFL",
  state,
  detail: "",
  home,
  away,
  startMs,
});

test("schedule split, leaders source and W/L", () => {
  const games = [game("a", "post", 1), game("b", "pre", 30), game("c", "post", 5), game("d", "pre", 20)];
  const { upcoming, results } = splitSchedule(games);
  assert.deepEqual(upcoming.map((g) => g.id), ["d", "b"]);
  assert.deepEqual(results.map((g) => g.id), ["c", "a"]);
  assert.deepEqual(leadersSource(games), { game: games[3], season: true });
  assert.deepEqual(leadersSource([games[0]]), { game: games[0], season: false });
  assert.equal(leadersSource([]), null);

  assert.equal(resultFor(game("x", "post", 0, side("1", "24", true), side("2", "17")), "1"), "W");
  assert.equal(resultFor(game("x", "post", 0, side("1", "24", true), side("2", "17")), "2"), "L");
  assert.equal(resultFor(game("x", "post", 0, side("1", "1"), side("2", "1")), "1"), "T");
  assert.equal(resultFor(game("x", "pre", 0), "1"), null);
  assert.equal(resultFor(game("x", "post", 0), "9"), null);
});
