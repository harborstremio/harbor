import assert from "node:assert/strict";
import test from "node:test";
import type { AsGet } from "../src/lib/jl/sports/as-core.ts";
import {
  bestPlayers,
  formOf,
  lineupSide,
  loadMatchCenter,
  marginPoints,
  periodRows,
  statGroups,
  timeline,
} from "../src/lib/jl/sports/match-center.ts";

const plain = (x: unknown) => JSON.parse(JSON.stringify(x));

// Ravens at Cowboys, final 34–31.
const EVENT = {
  homeScore: { current: 31, period1: 10, period2: 3, period3: 8, period4: 10 },
  awayScore: { current: 34, period1: 7, period2: 10, period3: 7, period4: 10 },
  periods: {
    current: "Score",
    period1: "1st quarter",
    period2: "2nd quarter",
    period3: "3rd quarter",
    period4: "4th quarter",
  },
};

test("score by quarter, overtime last", () => {
  assert.deepEqual(plain(periodRows(EVENT)), [
    { label: "Q1", away: 7, home: 10 },
    { label: "Q2", away: 10, home: 3 },
    { label: "Q3", away: 7, home: 8 },
    { label: "Q4", away: 10, home: 10 },
  ]);
  const ot = periodRows({
    ...EVENT,
    homeScore: { ...EVENT.homeScore, overtime: 3 },
    awayScore: { ...EVENT.awayScore, overtime: 0 },
  });
  assert.equal(ot[ot.length - 1].label, "OT");
  assert.equal(
    periodRows({
      homeScore: { period1: 1 },
      awayScore: { period1: 0 },
      periods: { period1: "1st half" },
    })[0].label,
    "H1",
  );
});

test("momentum: margin is home minus away", () => {
  // Feed ends at +3 while the home team lost 31–34: the feed is away-positive, so it flips.
  assert.deepEqual(
    plain(
      marginPoints(
        [
          { minute: 7, value: 3 },
          { minute: 60, value: 3 },
        ],
        31,
        34,
      ),
    ),
    [
      { minute: 7, margin: -3 },
      { minute: 60, margin: -3 },
    ],
  );
  assert.deepEqual(plain(marginPoints([{ minute: 60, value: -3 }], 31, 34)), [
    { minute: 60, margin: -3 },
  ]);
  assert.deepEqual(marginPoints(undefined, 1, 0), []);
});

test("timeline: soccer goals, cards, subs and breaks, oldest first", () => {
  const items = timeline(
    [
      { incidentType: "period", text: "FT", homeScore: 2, awayScore: 1 },
      {
        incidentType: "substitution",
        id: 5,
        isHome: false,
        time: 70,
        playerIn: { name: "Sub In" },
        playerOut: { name: "Sub Out" },
      },
      {
        incidentType: "card",
        incidentClass: "yellowRed",
        id: 4,
        isHome: true,
        time: 66,
        player: { name: "Defender" },
      },
      {
        incidentType: "goal",
        incidentClass: "penalty",
        id: 3,
        isHome: true,
        time: 45,
        addedTime: 2,
        player: { name: "Striker" },
        homeScore: 2,
        awayScore: 1,
      },
      { incidentType: "injuryTime", length: 3, time: 45 },
      {
        incidentType: "goal",
        incidentClass: "regular",
        id: 1,
        isHome: false,
        time: 12,
        player: { name: "Winger" },
        assist1: { name: "Mid" },
        homeScore: 0,
        awayScore: 1,
      },
    ],
    "football",
  );
  assert.deepEqual(
    items.map((i) => [i.kind, i.clock, i.title]),
    [
      ["score", "12'", "Goal"],
      ["score", "45+2'", "Penalty goal"],
      ["red", "66'", "Second yellow"],
      ["sub", "70'", "Substitution"],
      ["period", null, "FT"],
    ],
  );
  assert.equal(items[0].detail, "Assist: Mid");
  assert.deepEqual(items[1].score, { home: 2, away: 1 });
  assert.equal(items[3].player, "Sub In");
  assert.equal(items[3].detail, "Off: Sub Out");
});

test("timeline: US scoring plays with quarter and clock", () => {
  const items = timeline(
    [
      {
        incidentType: "goal",
        incidentClass: "touchdown",
        id: 1,
        isHome: false,
        timeSeconds: 1117,
        reversedPeriodTimeSeconds: 683,
        player: { name: "Derrick Henry" },
        awayScore: 13,
        homeScore: 10,
      },
    ],
    "american-football",
  );
  assert.equal(items[0].title, "Touchdown");
  assert.equal(items[0].clock, "Q2 11:23");
  assert.equal(items[0].side, "away");
});

test("stats, lineups, best players, form", () => {
  const groups = statGroups({
    statistics: [
      { period: "1ST", groups: [] },
      {
        period: "ALL",
        groups: [
          {
            groupName: "Overview",
            statisticsItems: [{ name: "Ball possession", home: "55%", away: "45%" }],
          },
        ],
      },
    ],
  });
  assert.equal(groups[0].rows[0].home, "55%");
  const side = lineupSide(
    {
      formation: "4-3-3",
      players: [
        { player: { id: 2, name: "Bench Guy" }, position: "M", substitute: true },
        {
          player: { id: 1, name: "Keeper" },
          position: "G",
          shirtNumber: 1,
          substitute: false,
          statistics: { saves: 3, rating: 7.25 },
        },
      ],
    },
    "football",
  );
  assert.equal(side.formation, "4-3-3");
  assert.equal(side.players[0].name, "Keeper");
  assert.equal(side.players[0].jersey, "1");
  assert.equal(side.players[0].line, "3 saves · 7.3");
  const nfl = lineupSide(
    {
      players: [
        {
          player: { id: 1, name: "Ryan Flournoy" },
          position: "WR",
          substitute: true,
          statistics: { receivingReceptions: 2, receivingYards: 22 },
        },
        { player: { id: 2, name: "Lineman" }, substitute: false },
      ],
    },
    "american-football",
  );
  assert.equal(nfl.players[0].line, "2 rec, 22 yds");
  assert.equal(
    bestPlayers({
      bestHomeTeamPlayer: { player: { id: 9, name: "Star" }, value: "8.4", label: "rating" },
    })[0].value,
    "8.4 rating",
  );
  assert.deepEqual(plain(formOf({ form: ["W", "L", "D", "W", "W", "L"], position: 3 })), {
    form: ["L", "D", "W", "W", "L"],
    place: 3,
  });
  assert.equal(formOf(null), null);
});

test("loader: one call per part, standings from the game's league and season", async () => {
  const asked: string[] = [];
  const answers: Record<string, unknown> = {
    "/api/match/7": {
      event: {
        id: 7,
        customId: "Xy",
        startTimestamp: 1790535900,
        status: { type: "finished", description: "Ended" },
        tournament: { uniqueTournament: { id: 17, name: "Premier League" } },
        season: { id: 61627 },
        venue: { name: "Emirates Stadium", city: { name: "London" } },
        homeTeam: { id: 42, name: "Arsenal" },
        awayTeam: { id: 33, name: "Spurs" },
        homeScore: { current: 2, period1: 1, period2: 1 },
        awayScore: { current: 1, period1: 0, period2: 1 },
        periods: { period1: "1st half", period2: "2nd half" },
      },
    },
    "/api/tournament/17/season/61627/standings/total": {
      standings: [
        {
          name: "Premier League",
          rows: [{ team: { id: 42, name: "Arsenal" }, position: 1, points: 19 }],
        },
      ],
    },
    "/api/match/Xy/h2h": {
      events: [
        {
          id: 7,
          startTimestamp: 1790535900,
          status: { type: "finished" },
          homeTeam: { id: 42, name: "Arsenal" },
          awayTeam: { id: 33, name: "Spurs" },
        },
        {
          id: 6,
          startTimestamp: 1760535900,
          status: { type: "finished" },
          homeTeam: { id: 33, name: "Spurs" },
          awayTeam: { id: 42, name: "Arsenal" },
        },
      ],
    },
    "/api/match/7/duel": { teamDuel: { homeWins: 80, awayWins: 60, draws: 50 } },
  };
  const get = (async (path: string) => {
    asked.push(path);
    if (path.endsWith("/lineups")) throw new Error("boom");
    return answers[path] ?? null;
  }) as AsGet;
  const m = await loadMatchCenter(get, "football", 7);
  if (!m) throw new Error("no match center");
  assert.equal(m.venue, "Emirates Stadium, London");
  assert.equal(m.periods.length, 2);
  assert.equal(m.standings[0].rows[0].teamId, 42);
  assert.deepEqual(
    m.meetings.map((g) => g.id),
    [6],
  );
  assert.deepEqual(m.series, { away: 60, home: 80, draws: 50 });
  assert.equal(m.lineups, null);
  assert.equal(new Set(asked).size, asked.length);
  assert.equal(await loadMatchCenter((async () => null) as AsGet, "football", 8), null);
});
