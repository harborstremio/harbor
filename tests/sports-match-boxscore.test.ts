import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCricketPartnerships,
  parsePlayerStatTables,
  parseTeamStatRows,
  parseCricketPlayerTables,
} from "../src/lib/sports/match-boxscore.ts";
import { parseTeamSummary } from "../src/lib/sports/espn-summary.ts";
import type { LeagueDef } from "../src/lib/sports/espn-types.ts";

const def: LeagueDef = {
  key: "AFL",
  tag: "AFL",
  group: "aussie",
  path: "australian-football/afl",
  label: "AFL",
  labelEn: "AFL",
  logo: "",
};
const header = {
  competitions: [
    {
      competitors: [
        { homeAway: "home", team: { id: "1", displayName: "Home", abbreviation: "H" } },
        { homeAway: "away", team: { id: "2", displayName: "Away", abbreviation: "A" } },
      ],
    },
  ],
};
const boxscore = {
  players: [
    {
      team: { id: "1" },
      statistics: [
        {
          labels: ["D", "G", "B"],
          descriptions: ["Disposals", "Goals", "Behinds"],
          athletes: [
            {
              athlete: { id: "13346", displayName: "Will Ashcroft", position: { name: "R" } },
              stats: ["30", "0", "1"],
            },
          ],
        },
      ],
    },
  ],
};

test("both teams' nested statistics survive with zero and missing values distinguished", () => {
  const result = parseTeamStatRows(
    { statistics: [{ name: "general", stats: [{ name: "points", value: 0 }] }] },
    {
      statistics: [
        {
          name: "general",
          stats: [
            { name: "points", displayValue: "12" },
            { name: "tackles", label: "Tackles", value: 7 },
          ],
        },
      ],
    },
  );
  assert.deepEqual(result, [
    { label: "points", homeValue: "0", awayValue: "12" },
    { label: "Tackles", homeValue: "—", awayValue: "7" },
  ]);
});

test("AFL and other team sports retain published boxscore athletes and complete columns", () => {
  for (const group of [
    "aussie",
    "lacrosse",
    "volleyball",
    "rugby",
    "softball",
    "fieldhockey",
    "basketball",
  ]) {
    const detail = parseTeamSummary({ ...def, group }, "1", { header, boxscore })!;
    assert.equal(detail.homeRoster[0].id, "13346");
    assert.equal(detail.homeRoster[0].position, "R");
    assert.deepEqual(detail.playerStats?.[0].rows[0].values, ["30", "0", "1"]);
    assert.equal(detail.playerStats?.[0].descriptions[0], "Disposals");
  }
});

test("malformed, duplicate and non-participating boxscore rows never become invented records", () => {
  assert.deepEqual(parsePlayerStatTables(null), []);
  const row = boxscore.players[0].statistics[0].athletes[0];
  const result = parsePlayerStatTables({
    players: [
      {
        team: { id: "1" },
        statistics: [
          {
            labels: ["A", "B"],
            athletes: [
              row,
              row,
              { athlete: { id: "2", displayName: "DNP" }, stats: [], didNotPlay: true },
              null,
              { athlete: { displayName: "No ID" }, stats: ["2"] },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(result[0].rows.length, 1);
  assert.deepEqual(result[0].rows[0].values, ["30", "0"]);
});

test("cricket cards preserve exact innings and validated team/player identity", () => {
  const detail = parseTeamSummary(def, "1", { header, boxscore })!;
  const teams = [
    { side: detail.home, roster: detail.homeRoster },
    { side: detail.away, roster: [] },
  ];
  const table = {
    headline: "Bowling",
    inningsNumber: "2",
    teamName: "H",
    playerDetails: [
      {
        playerID: "13346",
        overs: "4.0",
        maidens: "0",
        conceded: "36",
        wickets: "1",
        economyRate: "9",
      },
      { playerID: "wrong", wickets: "99" },
    ],
  };
  const result = parseCricketPlayerTables(
    { matchcards: [table, { ...table, teamName: "Unknown" }] },
    teams,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].innings, 2);
  assert.equal(result[0].rows.length, 1);
  assert.deepEqual(result[0].rows[0].values, ["4.0", "0", "36", "1", "9"]);
});

test("cricket roster lines restore earlier innings without duplicate cards or invented participants", () => {
  const detail = parseTeamSummary(def, "1", { header, boxscore })!;
  const player = detail.homeRoster[0];
  const teams = [{ side: detail.home, roster: [player, { ...player, id: "2" }] }];
  const line = (period: number, fields: Record<string, string | number>) => ({
    period,
    statistics: {
      categories: [
        {
          name: "general",
          stats: Object.entries({ inningsNumber: period, ...fields }).map(([name, value]) => ({
            name,
            value,
            displayValue: String(value),
          })),
        },
      ],
    },
  });
  const earlier = line(1, {
    batted: 1,
    battingPosition: 1,
    runs: 0,
    ballsFaced: 3,
    fours: 0,
    sixes: 0,
    dismissalCard: "lbw",
  });
  const later = line(2, {
    inningsBowled: 1,
    bowlingPosition: 1,
    overs: 4,
    maidens: 0,
    conceded: 36,
    wickets: 1,
    economyRate: 9,
  });
  const card = {
    teamName: "H",
    headline: "Bowling",
    inningsNumber: "2",
    playerDetails: [
      {
        playerID: player.id,
        overs: "4.0",
        maidens: "0",
        conceded: "36",
        wickets: "1",
        economyRate: "9",
      },
    ],
  };
  const raw = {
    matchcards: [card, card],
    rosters: [
      {
        team: { id: "1" },
        roster: [
          { athlete: { id: player.id }, linescores: [earlier, later] },
          { athlete: { id: player.id }, linescores: [earlier] },
          {
            athlete: { id: "2" },
            linescores: [
              line(1, { batted: 0, runs: 0 }),
              line(2, { inningsBowled: 0, overs: 0 }),
              { ...earlier, period: 4 },
            ],
          },
          { athlete: { id: "unknown" }, linescores: [earlier] },
        ],
      },
    ],
  };
  const tables = parseCricketPlayerTables(raw, teams);
  assert.equal(tables.length, 2);
  assert.equal(tables[0].innings, 1);
  assert.equal(tables[0].rows.length, 1);
  assert.deepEqual(tables[0].rows[0].values, ["0", "3", "0", "0", "lbw"]);
  assert.equal(tables[1].rows.length, 1);
  assert.equal(tables[1].rows[0].values[0], "4.0"); // Published card takes precedence over roster formatting.
});

test("partnerships preserve published names and zero runs without guessing athlete IDs", () => {
  const detail = parseTeamSummary(def, "1", { header, boxscore })!;
  const card = {
    teamName: "H",
    headline: "Partnerships",
    inningsNumber: "2",
    playerDetails: [
      {
        partnershipWicketName: "1st",
        partnershipRuns: 0,
        partnershipOvers: "0.2",
        player1Name: "Player One",
        player1Runs: 0,
        player2Name: "Player Two",
        player2Runs: 0,
      },
      { partnershipWicketName: "2nd", player1Name: "Missing partner" },
    ],
  };
  const result = parseCricketPartnerships(
    {
      matchcards: [card, card, { ...card, teamName: "Unknown" }, { ...card, inningsNumber: "99" }],
    },
    [detail.home, detail.away],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].rows.length, 1);
  assert.equal(result[0].innings, 2);
  assert.deepEqual(result[0].rows[0], {
    wicket: "1st",
    runs: "0",
    overs: "0.2",
    players: [
      { name: "Player One", runs: "0" },
      { name: "Player Two", runs: "0" },
    ],
  });
});
