import assert from "node:assert/strict";
import test from "node:test";
import { followedInjuries, parsePlayerLine, parsePregame } from "../src/lib/jl/sports/insight.ts";

const SUMMARY = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: { id: "194", abbreviation: "OSU" },
            record: [{ type: "total", summary: "5-0" }],
          },
          {
            homeAway: "away",
            team: { id: "356", abbreviation: "ILL" },
            record: [{ type: "total", summary: "3-2" }],
          },
        ],
      },
    ],
  },
  predictor: { homeTeam: { gameProjection: "78.4" }, awayTeam: { gameProjection: "21.6" } },
  leaders: [
    {
      team: { id: "194" },
      leaders: [
        { displayName: "Passing Yards", leaders: [{ displayValue: "1,412 YDS", athlete: { id: "9", displayName: "Q. Back" } }] },
        { displayName: "Rushing Yards", leaders: [] },
      ],
    },
  ],
  injuries: [
    {
      team: { id: "356" },
      injuries: [{ status: "Questionable", athlete: { id: "77", displayName: "W. Receiver" } }],
    },
  ],
};

test("pre-game insight: records, projection, leaders, injuries by side", () => {
  const insight = parsePregame(SUMMARY);
  assert.deepEqual(insight.home, {
    teamId: "194",
    abbr: "OSU",
    record: "5-0",
    winChance: 78,
    leaders: [{ category: "Passing Yards", athlete: "Q. Back", athleteId: "9", value: "1,412 YDS" }],
    injuries: [],
  });
  assert.equal(insight.away?.winChance, 22);
  assert.deepEqual(insight.away?.injuries, [{ athlete: "W. Receiver", athleteId: "77", status: "Questionable" }]);
});

test("a summary without a predictor or leaders still yields both sides", () => {
  const insight = parsePregame({ header: SUMMARY.header });
  assert.equal(insight.home?.winChance, null);
  assert.deepEqual(insight.home?.leaders, []);
  assert.equal(parsePregame(null).home, null);
});

test("injuries that concern followed players", () => {
  const insight = parsePregame(SUMMARY);
  assert.deepEqual(followedInjuries(insight, [{ id: "77", name: "Someone Else" }]), [
    { athlete: "W. Receiver", athleteId: "77", status: "Questionable" },
  ]);
  assert.deepEqual(followedInjuries(insight, [{ id: "1", name: "Q. Back" }]), []);
});

test("a followed player's season line", () => {
  const line = parsePlayerLine({
    athlete: {
      displayName: "Markus Turner",
      team: { displayName: "Gallaudet Bison" },
      statsSummary: { statistics: [{ displayName: "Receiving Yards", displayValue: "412" }, { displayName: "" }] },
    },
  });
  assert.deepEqual(line, {
    name: "Markus Turner",
    teamName: "Gallaudet Bison",
    stats: [{ label: "Receiving Yards", value: "412" }],
  });
  assert.equal(parsePlayerLine({}), null);
});
