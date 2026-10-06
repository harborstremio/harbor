import assert from "node:assert/strict";
import test from "node:test";
import {
  activeLineup,
  parseFootballSituation,
  pitchRows,
  yardsFromOwnGoal,
  type PitchPlayer,
} from "../src/lib/jl/sports/live-field.ts";

const TEAMS = { home: { id: "12", abbr: "KC" }, away: { id: "2", abbr: "BUF" } };

test("ball spot is measured from the offense's own goal line", () => {
  assert.equal(yardsFromOwnGoal("KC 25", "KC"), 25);
  assert.equal(yardsFromOwnGoal("BUF 40", "KC"), 60);
  assert.equal(yardsFromOwnGoal("50", "KC"), 50);
  assert.equal(yardsFromOwnGoal("", "KC"), null);
  assert.equal(yardsFromOwnGoal("KC 75", "KC"), null);
});

test("live football situation from the summary", () => {
  const s = parseFootballSituation(
    {
      situation: {
        possession: "12",
        possessionText: "BUF 40",
        distance: 7,
        downDistanceText: "2nd & 7 at BUF 40",
        lastPlay: { text: "P.Mahomes pass short right to T.Kelce for 3 yards" },
      },
    },
    TEAMS,
  );
  assert.deepEqual(s, {
    offense: "KC",
    defense: "BUF",
    ballYard: 60,
    firstDownYard: 67,
    downText: "2nd & 7 at BUF 40",
    redZone: false,
    lastPlay: "P.Mahomes pass short right to T.Kelce for 3 yards",
  });
});

test("goal to go has no first-down line; inside the 20 is the red zone; header situation is used too", () => {
  const s = parseFootballSituation(
    {
      header: {
        competitions: [
          { situation: { possession: { id: "2" }, possessionText: "KC 8", distance: 8, downDistanceText: "1st & Goal at KC 8" } },
        ],
      },
    },
    TEAMS,
  );
  assert.equal(s?.offense, "BUF");
  assert.equal(s?.ballYard, 92);
  assert.equal(s?.firstDownYard, null);
  assert.equal(s?.redZone, true);
});

test("no situation between plays or before kick-off", () => {
  assert.equal(parseFootballSituation({}, TEAMS), null);
  assert.equal(parseFootballSituation({ situation: { possession: "99", possessionText: "KC 20" } }, TEAMS), null);
});

function player(id: string, position: string, extra: Partial<PitchPlayer> = {}): PitchPlayer {
  return {
    id,
    name: `Player ${id}`,
    jersey: id,
    position,
    starter: true,
    substitutedIn: false,
    substitutedOut: false,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    ...extra,
  };
}

const XI = [
  player("1", "G"),
  player("2", "LB"),
  player("3", "CD-L"),
  player("4", "CD-R"),
  player("5", "RB"),
  player("6", "DM"),
  player("7", "CM"),
  player("8", "AM", { substitutedOut: true }),
  player("9", "LW"),
  player("10", "CF", { goals: 1 }),
  player("11", "RW", { redCards: 1 }),
];

test("on the pitch now: a substitute takes the replaced player's line; a sent-off player is off", () => {
  const roster = [
    ...XI,
    player("14", "CM", { starter: false, substitutedIn: true }),
    player("15", "F", { starter: false }),
  ];
  const ids = activeLineup(roster).map((p) => p.id);
  assert.deepEqual(ids, ["1", "2", "3", "4", "5", "6", "7", "14", "9", "10"]);
});

test("rows follow the formation from the goalkeeper forward, or group by line", () => {
  const lineup = XI.map((p) => ({ ...p, substitutedOut: false, redCards: 0 }));
  assert.deepEqual(
    pitchRows(lineup, "4-3-3").map((r) => r.map((p) => p.id)),
    [["1"], ["2", "3", "4", "5"], ["6", "7", "8"], ["9", "10", "11"]],
  );
  const ten = activeLineup(XI.map((p) => ({ ...p, substitutedOut: false })));
  assert.deepEqual(
    pitchRows(ten, "4-3-3").map((r) => r.map((p) => p.id)),
    [["1"], ["2", "3", "4", "5"], ["6", "7", "8"], ["9", "10"]],
  );
});
