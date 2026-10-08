import assert from "node:assert/strict";
import test from "node:test";
import {
  athleteIdFromRef,
  corePath,
  groupForTeam,
  parseLeaders,
  parseLeagueTeams,
  parseStandings,
  standingColumns,
} from "../src/lib/jl/sports/espn-league.ts";

const entry = (id: string, name: string, stats: Record<string, [number, string]>) => ({
  team: { id, displayName: name, abbreviation: name.slice(0, 3).toUpperCase(), logos: [{ href: `http://a/${id}.png` }] },
  stats: Object.entries(stats).map(([n, [value, displayValue]]) => ({ name: n, value, displayValue })),
});

test("US standings: conferences as tables, sorted by seed, ties only when any", () => {
  const groups = parseStandings({
    children: [
      {
        name: "American Football Conference",
        standings: {
          entries: [
            entry("2", "Bills", { playoffSeed: [2, "2"], wins: [9, "9"], losses: [4, "4"], ties: [0, "0"], winPercent: [0.69, ".692"] }),
            entry("12", "Chiefs", { playoffSeed: [1, "1"], wins: [10, "10"], losses: [3, "3"], ties: [0, "0"], winPercent: [0.77, ".769"] }),
          ],
        },
      },
      { name: "Empty", standings: { entries: [] } },
    ],
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "American Football Conference");
  assert.deepEqual(groups[0].rows.map((r) => [r.id, r.logo]), [["12", "https://a/12.png"], ["2", "https://a/2.png"]]);
  assert.deepEqual(standingColumns("football", groups), [
    { key: "wins", label: "W" },
    { key: "losses", label: "L" },
    { key: "winPercent", label: "Pct" },
  ]);
  assert.equal(groupForTeam(groups, "12"), groups[0]);
  assert.equal(groupForTeam(groups, "99"), null);
});

test("soccer table: one league table sorted by rank with soccer columns", () => {
  const groups = parseStandings({
    name: "English Premier League",
    standings: {
      entries: [
        entry("1", "Arsenal", { rank: [2, "2"], gamesPlayed: [7, "7"], wins: [5, "5"], ties: [1, "1"], losses: [1, "1"], points: [16, "16"] }),
        entry("2", "Liverpool", { rank: [1, "1"], gamesPlayed: [7, "7"], wins: [6, "6"], ties: [0, "0"], losses: [1, "1"], points: [18, "18"] }),
      ],
    },
  });
  assert.deepEqual(groups[0].rows.map((r) => r.name), ["Liverpool", "Arsenal"]);
  assert.deepEqual(
    standingColumns("soccer", groups).map((c) => c.label),
    ["GP", "W", "D", "L", "Pts"],
  );
});

test("athlete standings fall back to the first row's stats", () => {
  const groups = parseStandings({
    standings: { entries: [{ athlete: { id: "5", displayName: "Driver" }, stats: [{ name: "rank", value: 1 }, { name: "championshipPts", value: 300, displayValue: "300" }] }] },
  });
  assert.equal(groups[0].rows[0].kind, "athlete");
  assert.deepEqual(standingColumns("motorsport", groups), [{ key: "championshipPts", label: "Championship Pts" }]);
  assert.deepEqual(parseStandings(null), []);
});

test("league teams by name, inactive teams left out", () => {
  const teams = parseLeagueTeams({
    sports: [
      {
        leagues: [
          {
            teams: [
              { team: { id: "2", displayName: "Zeta", logos: [{ href: "http://z.png" }] } },
              { team: { id: "1", displayName: "Alpha", abbreviation: "ALP" } },
              { team: { id: "3", displayName: "Gone", isActive: false } },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(teams, [
    { id: "1", name: "Alpha", abbr: "ALP", logo: null },
    { id: "2", name: "Zeta", abbr: "", logo: "https://z.png" },
  ]);
});

test("leaders: inline athletes and core references", () => {
  const inline = parseLeaders({
    leaders: {
      categories: [
        {
          name: "passingYards",
          displayName: "Passing Yards",
          leaders: [{ displayValue: "3,210", athlete: { id: "1", displayName: "QB", headshot: { href: "http://h.png" }, team: { abbreviation: "KC" } } }],
        },
      ],
    },
  });
  assert.deepEqual(inline, [
    { key: "passingYards", label: "Passing Yards", leaders: [{ athleteId: "1", name: "QB", headshot: "https://h.png", team: "KC", value: "3,210", ref: null }] },
  ]);
  const core = parseLeaders(
    {
      categories: [
        {
          name: "points",
          displayName: "Points",
          leaders: [
            { displayValue: "30.1", athlete: { $ref: "http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/athletes/3945274?lang=en" } },
            { displayValue: "29.0", athlete: { $ref: "http://x/athletes/2" } },
          ],
        },
      ],
    },
    1,
  );
  assert.equal(core[0].leaders.length, 1);
  assert.equal(core[0].leaders[0].athleteId, "3945274");
  assert.equal(core[0].leaders[0].name, null);
  assert.match(core[0].leaders[0].ref ?? "", /^https:\/\//);
  assert.equal(athleteIdFromRef("https://x/athletes/12/statistics"), "12");
  assert.equal(athleteIdFromRef("https://x/teams/12"), null);
  assert.equal(corePath("soccer/eng.1"), "soccer/leagues/eng.1");
  assert.equal(corePath("rugby"), null);
});
