import assert from "node:assert/strict";
import test from "node:test";
import {
  activeLineup,
  fieldX,
  parseFootballSituation,
  pitchRows,
  sideColors,
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
    offenseIsHome: true,
    ballYard: 60,
    firstDownYard: 67,
    downText: "2nd & 7 at BUF 40",
    redZone: false,
    lastPlay: "P.Mahomes pass short right to T.Kelce for 3 yards",
    drive: null,
    driveStart: null,
    previousDrive: null,
    timeouts: null,
    offenseColor: "#38bdf8",
    defenseColor: "#f8fafc",
  });
});

test("goal to go has no first-down line; inside the 20 is the red zone; header situation is used too", () => {
  const s = parseFootballSituation(
    {
      header: {
        competitions: [
          {
            situation: {
              possession: { id: "2" },
              possessionText: "KC 8",
              distance: 8,
              downDistanceText: "1st & Goal at KC 8",
            },
          },
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

test("a spot naming neither team is rejected when the defense is known", () => {
  assert.equal(yardsFromOwnGoal("WSH 30", "KC", "BUF"), null);
  assert.equal(yardsFromOwnGoal("TA&M 30", "LSU", "TA&M"), 70);
});

test("fixed field: away end zone left, home end zone right", () => {
  assert.equal(fieldX(25, false), 25);
  assert.equal(fieldX(25, true), 75);
});

test("team colours stay readable on a dark field and apart from each other", () => {
  assert.deepEqual(
    sideColors({ color: "000000", alternateColor: "c41e3a" }, { color: "#C41E3A" }),
    {
      home: "#c41e3a",
      away: "#f8fafc",
    },
  );
  assert.deepEqual(sideColors({ color: "bb0000" }, { color: "13294b", alternateColor: "ff5f05" }), {
    home: "#bb0000",
    away: "#ff5f05",
  });
});

const COLLEGE = {
  header: {
    competitions: [
      {
        competitors: [
          {
            homeAway: "home",
            team: { id: "194", abbreviation: "OSU", color: "bb0000", alternateColor: "666666" },
          },
          {
            homeAway: "away",
            team: { id: "356", abbreviation: "ILL", color: "ff5f05", alternateColor: "13294b" },
          },
        ],
      },
    ],
  },
  drives: {
    previous: [{ displayResult: "Punt", plays: [{ text: "J.Smith punt for 44 yards" }] }],
    current: {
      description: "4 plays, 31 yards, 1:58",
      team: { id: "194", abbreviation: "OSU" },
      start: { text: "OSU 20" },
      plays: [
        { text: "W.Howard pass to J.Smith for 12 yards" },
        {
          text: "Q.Judkins run for 6 yards",
          end: {
            team: { id: "194" },
            possessionText: "ILL 49",
            yardsToEndzone: 49,
            distance: 4,
            downDistanceText: "2nd & 4 at ILL 49",
          },
        },
      ],
    },
  },
};

test("college: between snaps the drive in progress gives the spot, drive and last play", () => {
  const s = parseFootballSituation(COLLEGE, {
    home: { id: "194", abbr: "OSU" },
    away: { id: "356", abbr: "ILL" },
  });
  assert.equal(s?.offense, "OSU");
  assert.equal(s?.offenseIsHome, true);
  assert.equal(s?.ballYard, 51);
  assert.equal(s?.firstDownYard, 55);
  assert.equal(s?.downText, "2nd & 4 at ILL 49");
  assert.equal(s?.drive, "4 plays, 31 yards, 1:58");
  assert.equal(s?.driveStart, "OSU 20");
  assert.equal(s?.previousDrive, "Punt");
  assert.equal(s?.lastPlay, "Q.Judkins run for 6 yards");
  assert.equal(s?.offenseColor, "#bb0000");
  assert.equal(s?.defenseColor, "#ff5f05");
});

test("situation with timeouts wins over the drive; yardsToEndzone fills a missing possessionText", () => {
  const s = parseFootballSituation(
    {
      ...COLLEGE,
      situation: {
        possession: "356",
        yardsToEndzone: 12,
        distance: 10,
        homeTimeouts: 2,
        awayTimeouts: 3,
      },
    },
    { home: { id: "194", abbr: "OSU" }, away: { id: "356", abbr: "ILL" } },
  );
  assert.equal(s?.offense, "ILL");
  assert.equal(s?.ballYard, 88);
  assert.equal(s?.redZone, true);
  assert.equal(s?.firstDownYard, 98);
  assert.deepEqual(s?.timeouts, { home: 2, away: 3 });
});

test("no situation between plays or before kick-off", () => {
  assert.equal(parseFootballSituation({}, TEAMS), null);
  assert.equal(
    parseFootballSituation({ situation: { possession: "99", possessionText: "KC 20" } }, TEAMS),
    null,
  );
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
