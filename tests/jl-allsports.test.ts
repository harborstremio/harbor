import assert from "node:assert/strict";
import test from "node:test";
import {
  asDetail,
  createRateGate,
  dayPath,
  imagePath,
  matchPath,
  tables,
  toGame,
  tournamentPath,
} from "../src/lib/jl/sports/as-core.ts";

// Shape of /api/<sport>/matches/live and /match/<id> answers.
const NFL = {
  id: 16166709,
  customId: "aBcD",
  startTimestamp: 1790535900,
  tournament: { name: "NFL", uniqueTournament: { id: 9464, name: "NFL" } },
  season: { id: 75522 },
  roundInfo: { round: 4 },
  status: { code: 14, description: "2nd quarter", type: "inprogress" },
  time: { played: 1215, periodLength: 900, overtimeLength: 600, totalPeriodCount: 4 },
  homeTeam: {
    id: 4389,
    name: "San Francisco 49ers",
    shortName: "49ers",
    nameCode: "SF",
    teamColors: { primary: "#aa0000" },
  },
  awayTeam: { id: 4400, name: "Arizona\tCardinals", shortName: "Cardinals", nameCode: "ARI" },
  homeScore: { current: 14 },
  awayScore: { current: 0 },
};

test("AllSports paths per sport", () => {
  assert.equal(matchPath("football", 1), "/api/match/1");
  assert.equal(matchPath("tennis", 2), "/api/tennis/event/2");
  assert.equal(matchPath("basketball", 3), "/api/basketball/match/3");
  assert.equal(tournamentPath("football", 17), "/api/tournament/17");
  assert.equal(tournamentPath("handball", 30), "/api/handball/unique-tournament/30");
  assert.equal(imagePath("ice-hockey", "team", 5), "/api/ice-hockey/team/5/image");
  assert.equal(imagePath("football", "tournament", 17), "/api/tournament/17/image");
  const day = new Date(Date.UTC(2026, 9, 8, 22));
  assert.equal(dayPath("football", day), "/api/matches/8/10/2026");
  assert.equal(dayPath("tennis", day), "/api/tennis/events/8/10/2026");
});

test("AllSports game: teams, scores, clock, league ids", () => {
  const g = toGame(NFL, "american-football");
  if (!g) throw new Error("no game");
  assert.equal(g.state, "in");
  assert.equal(g.detail, "Q2 9:45");
  assert.equal(g.home.short, "49ers");
  assert.equal(g.home.color, "aa0000");
  assert.equal(g.away.name, "Arizona Cardinals");
  assert.equal(g.away.score, "0");
  assert.equal(g.tournamentId, 9464);
  assert.equal(g.seasonId, 75522);
  assert.equal(g.customId, "aBcD");
  assert.equal(g.round, 4);
  assert.equal(g.startMs, 1790535900000);
  assert.equal(toGame({ ...NFL, homeTeam: undefined }, "american-football"), null);
  const final = toGame(
    { ...NFL, status: { type: "finished", description: "Ended" } },
    "american-football",
  );
  assert.equal(final?.state, "post");
  assert.equal(final?.detail, "Ended");
});

test("AllSports status text", () => {
  assert.equal(
    asDetail({ status: { description: "8th Inning", type: "inprogress" }, time: {} }, "baseball"),
    "8th inning",
  );
  assert.equal(
    asDetail({ status: { description: "Halftime", type: "inprogress" } }, "american-football"),
    "Half",
  );
  assert.equal(
    asDetail({ status: { description: "2nd half", type: "inprogress" } }, "football"),
    "2nd half",
  );
  assert.equal(
    asDetail({ status: { description: "Ended", type: "finished" } }, "basketball"),
    null,
  );
});

test("standings tables", () => {
  const t = tables({
    standings: [
      {
        name: "Premier League",
        rows: [
          {
            team: { id: 42, name: "Arsenal", shortName: "Arsenal" },
            position: 1,
            matches: 7,
            wins: 6,
            losses: 0,
            draws: 1,
            scoresFor: 18,
            scoresAgainst: 4,
            scoreDiffFormatted: "+14",
            points: 19,
          },
        ],
      },
      { name: "Empty", rows: [] },
    ],
  });
  assert.equal(t.length, 1);
  assert.equal(t[0].rows[0].teamId, 42);
  assert.equal(t[0].rows[0].points, 19);
  assert.equal(t[0].rows[0].diff, "+14");
  assert.deepEqual(tables(null), []);
});

test("rate gate: at most 8 requests start in any second", async () => {
  let t = 0;
  const gate = createRateGate(
    8,
    () => t,
    async (ms) => {
      t += ms;
    },
  );
  const starts: number[] = [];
  for (let i = 0; i < 20; i++) {
    await gate();
    starts.push(t);
  }
  for (const s of starts) assert.ok(starts.filter((x) => x >= s && x < s + 1000).length <= 8);
  assert.ok(starts[19] >= 2000 && starts[19] < 2100);
});
