import assert from "node:assert/strict";
import test from "node:test";
import { parseSoccerLive, pitchSpot, soccerEventKind } from "../src/lib/jl/sports/soccer-live.ts";

function mustParse(summary: unknown) {
  const live = parseSoccerLive(summary);
  if (!live) throw new Error("expected a match");
  return live;
}

// Shaped like ESPN's soccer match summary (header, boxscore, rosters, keyEvents, commentary).
const team = (id: string, abbr: string, name: string, color: string, alternateColor: string) => ({
  id,
  abbreviation: abbr,
  displayName: name,
  shortDisplayName: name,
  name,
  color,
  alternateColor,
});
const ARS = team("359", "ARS", "Arsenal", "e20520", "132257");
const CHE = team("363", "CHE", "Chelsea", "144992", "ffffff");

const stats = (possession: string, shots: string, onTarget: string, corners: string) => [
  { name: "foulsCommitted", displayValue: "9", label: "Fouls" },
  { name: "possessionPct", displayValue: possession, label: "Possession" },
  { name: "totalShots", displayValue: shots, label: "SHOTS" },
  { name: "shotsOnTarget", displayValue: onTarget, label: "ON GOAL" },
  { name: "wonCorners", displayValue: corners, label: "Corner Kicks" },
];

const athlete = (id: string, displayName: string) => ({ athlete: { id, displayName } });

const SUMMARY = {
  header: {
    competitions: [
      {
        status: {
          displayClock: "67'",
          period: 2,
          type: { name: "STATUS_SECOND_HALF", state: "in", shortDetail: "67'", detail: "67'" },
        },
        competitors: [
          { homeAway: "home", score: "2", team: ARS },
          { homeAway: "away", score: "1", team: CHE },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      { team: { id: "359" }, statistics: stats("58.3", "11", "5", "6") },
      { team: { id: "363" }, statistics: stats("41.7", "7", "2", "3") },
    ],
  },
  rosters: [
    {
      homeAway: "home",
      team: { id: "359" },
      formation: "4-3-3",
      roster: [
        {
          starter: true,
          jersey: "7",
          athlete: { id: "1", displayName: "Bukayo Saka" },
          position: { abbreviation: "RW" },
          stats: [{ name: "totalGoals", value: 1 }],
        },
        {
          starter: true,
          jersey: "1",
          athlete: { id: "2", displayName: "David Raya" },
          position: { abbreviation: "G" },
        },
      ],
    },
    { homeAway: "away", team: { id: "363" }, formation: "4-2-3-1", roster: [] },
  ],
  keyEvents: [
    {
      id: "k0",
      type: { id: "80", text: "Kickoff" },
      text: "First Half begins.",
      clock: { value: 0, displayValue: "0'" },
    },
    {
      id: "k1",
      type: { id: "70", text: "Goal - Header" },
      scoringPlay: true,
      text: "Goal! Arsenal 1, Chelsea 0. Bukayo Saka (Arsenal) header from the centre of the box.",
      clock: { value: 1380, displayValue: "23'" },
      team: { id: "359", displayName: "Arsenal" },
      participants: [athlete("1", "Bukayo Saka")],
      fieldPositionX: 0.9,
      fieldPositionY: 0.45,
      fieldPosition2X: 1,
      fieldPosition2Y: 0.5,
    },
    {
      id: "k2",
      type: { id: "94", text: "Yellow Card" },
      text: "Moises Caicedo (Chelsea) is shown the yellow card for a bad foul.",
      clock: { value: 2400, displayValue: "40'" },
      team: { id: "363", displayName: "Chelsea" },
      participants: [athlete("9", "Moises Caicedo")],
      fieldPositionX: 0,
      fieldPositionY: 0,
    },
    {
      id: "k3",
      type: { id: "137", text: "Penalty - Scored" },
      scoringPlay: true,
      text: "Goal! Arsenal 1, Chelsea 1. Cole Palmer (Chelsea) converts the penalty.",
      clock: { value: 3060, displayValue: "51'" },
      team: { id: "363", displayName: "Chelsea" },
      participants: [athlete("10", "Cole Palmer")],
    },
    {
      id: "k4",
      type: { id: "97", text: "Own Goal" },
      scoringPlay: true,
      text: "Own Goal by Levi Colwill, Chelsea. Arsenal 2, Chelsea 1.",
      clock: { value: 3480, displayValue: "58'" },
      team: { id: "363", displayName: "Chelsea" },
      participants: [athlete("11", "Levi Colwill")],
    },
    {
      id: "k5",
      type: { id: "76", text: "Substitution" },
      text: "Substitution, Chelsea. Nicolas Jackson replaces Christopher Nkunku.",
      clock: { value: 3720, displayValue: "62'" },
      team: { id: "363", displayName: "Chelsea" },
      participants: [athlete("12", "Nicolas Jackson"), athlete("13", "Christopher Nkunku")],
    },
  ],
  commentary: [
    { sequence: 1, time: { value: 0, displayValue: "0'" }, text: "First Half begins." },
    {
      sequence: 20,
      time: { value: 1380, displayValue: "23'" },
      text: "Goal! Arsenal 1, Chelsea 0. Bukayo Saka (Arsenal) header from the centre of the box.",
    },
    {
      sequence: 60,
      time: { value: 3600, displayValue: "60'" },
      text: "Attempt saved. Declan Rice (Arsenal) right footed shot from outside the box.",
      play: {
        id: "p60",
        type: { text: "Shot On Target" },
        team: { displayName: "Arsenal" },
        participants: [athlete("5", "Declan Rice")],
        fieldPositionX: 0.78,
        fieldPositionY: 0.3,
      },
    },
    {
      sequence: 65,
      time: { value: 3840, displayValue: "64'" },
      text: "Corner,  Chelsea. Conceded by William Saliba.",
    },
    {
      sequence: 66,
      time: { value: 3900, displayValue: "65'" },
      text: "Attempt missed. Cole Palmer (Chelsea) left footed shot from outside the box is too high.",
      play: {
        id: "p66",
        type: { text: "Shot Off Target" },
        team: { id: "363" },
        participants: [athlete("10", "Cole Palmer")],
        fieldPositionX: 0.75,
        fieldPositionY: 0.2,
        fieldPosition2X: 1,
        fieldPosition2Y: 0.55,
      },
    },
  ],
};

test("event kinds from ESPN types or commentary wording", () => {
  assert.equal(soccerEventKind("Goal - Header", ""), "goal");
  assert.equal(soccerEventKind("Penalty - Scored", "", true), "penalty_goal");
  assert.equal(soccerEventKind("Own Goal", "", true), "own_goal");
  assert.equal(soccerEventKind("Goal Kick", ""), "other");
  assert.equal(soccerEventKind("Yellow Card", ""), "yellow");
  assert.equal(soccerEventKind("Red Card", ""), "red");
  assert.equal(soccerEventKind("Substitution", ""), "sub");
  assert.equal(soccerEventKind("Shot On Target", ""), "shot_on_target");
  assert.equal(soccerEventKind("Penalty - Missed", ""), "shot");
  assert.equal(soccerEventKind("", "Corner,  Chelsea. Conceded by William Saliba."), "corner");
  assert.equal(soccerEventKind("", "Attempt blocked. Kai Havertz (Arsenal) …"), "shot");
  assert.equal(soccerEventKind("", "Goal! Arsenal 1, Chelsea 0."), "goal");
  assert.equal(soccerEventKind("", "Second Half begins Arsenal 1, Chelsea 0."), "period");
});

test("pitch spots: home as given, away flipped, 0/0 and out-of-range dropped, 0–100 scaled", () => {
  assert.deepEqual(pitchSpot(0.9, 0.25, "home"), { x: 0.9, y: 0.25 });
  assert.deepEqual(pitchSpot(0.9, 0.25, "away"), { x: 0.09999999999999998, y: 0.75 });
  assert.equal(pitchSpot(0, 0, "home"), null);
  assert.equal(pitchSpot(0.5, 0.5, null), null);
  assert.equal(pitchSpot(150, 20, "home"), null);
  assert.deepEqual(pitchSpot(80, 50, "home"), { x: 0.8, y: 0.5 });
});

test("live soccer: score, clock, stats, colours and lineups", () => {
  const live = mustParse(SUMMARY);
  assert.equal(live.state, "in");
  assert.equal(live.clock, "67'");
  assert.deepEqual(
    [live.home.abbr, live.home.score, live.away.abbr, live.away.score],
    ["ARS", "2", "CHE", "1"],
  );
  assert.equal(live.home.color, "#e20520");
  assert.equal(live.away.color, "#144992");
  assert.deepEqual(live.possession, { home: 58.3, away: 41.7 });
  assert.deepEqual(live.shots, { home: 11, away: 7 });
  assert.deepEqual(live.shotsOnTarget, { home: 5, away: 2 });
  assert.deepEqual(live.corners, { home: 6, away: 3 });
  assert.equal(live.homeFormation, "4-3-3");
  assert.equal(live.homeRoster[0].goals, 1);
  assert.equal(live.homeRoster[1].position, "G");
  assert.equal(live.awayRoster.length, 0);
});

test("goal scorers: penalties marked, own goals credited to the other side, no commentary repeats", () => {
  const live = mustParse(SUMMARY);
  assert.deepEqual(live.scorers, [
    { player: "Bukayo Saka", minute: "23'", side: "home", ownGoal: false, penalty: false },
    { player: "Cole Palmer", minute: "51'", side: "away", ownGoal: false, penalty: true },
    { player: "Levi Colwill", minute: "58'", side: "home", ownGoal: true, penalty: false },
  ]);
});

test("feed newest first; last key event; latest located event flipped for the away side", () => {
  const live = mustParse(SUMMARY);
  assert.deepEqual(
    live.events.map((e) => [e.minute, e.kind, e.side]),
    [
      ["65'", "shot", "away"],
      ["64'", "corner", "away"],
      ["62'", "sub", "away"],
      ["60'", "shot_on_target", "home"],
      ["58'", "own_goal", "away"],
      ["51'", "penalty_goal", "away"],
      ["40'", "yellow", "away"],
      ["23'", "goal", "home"],
      ["0'", "period", null],
    ],
  );
  assert.equal(live.lastKey?.kind, "corner");
  assert.equal(live.lastKey?.side, "away");
  assert.equal(live.lastSpot?.id, "p66");
  assert.equal(live.lastSpot?.player, "Cole Palmer");
  assert.deepEqual(live.lastSpot?.spot, { x: 0.25, y: 0.8 });
  assert.deepEqual(live.lastSpot?.end, { x: 0, y: 0.44999999999999996 });
  // The yellow card's 0/0 is "not recorded", not a corner flag.
  assert.equal(live.events.find((e) => e.kind === "yellow")?.spot, null);
});

test("momentum weighs shots, corners and goals in the last 15 minutes", () => {
  const live = mustParse(SUMMARY);
  // Since 50': home shot on target (2); away penalty goal (3), corner (1), shot (1).
  assert.equal(live.momentum, (2 - 5) / 7);
});

test("no coordinates or stats: a clean pitch, no fake spot", () => {
  const live = mustParse({
    header: {
      competitions: [
        {
          status: {
            displayClock: "45'+2'",
            type: { name: "STATUS_HALFTIME", state: "in", shortDetail: "HT" },
          },
          competitors: [
            {
              homeAway: "home",
              score: "0",
              team: { id: "1", abbreviation: "HOM", color: "000000" },
            },
            { homeAway: "away", score: "0", team: { id: "2", abbreviation: "AWY" } },
          ],
        },
      ],
    },
    keyEvents: [
      { id: "x", type: { text: "Halftime" }, clock: { value: 2820, displayValue: "45'+2'" } },
    ],
  });
  assert.equal(live.clock, "HT");
  assert.equal(live.lastSpot, null);
  assert.equal(live.lastKey, null);
  assert.equal(live.possession, null);
  assert.equal(live.momentum, null);
  assert.deepEqual(live.scorers, []);
  assert.equal(live.home.color, "#38bdf8");
});

test("not a match summary", () => {
  assert.equal(parseSoccerLive(null), null);
  assert.equal(parseSoccerLive({ header: { competitions: [{ competitors: [] }] } }), null);
});
