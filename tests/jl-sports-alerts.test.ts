import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import type { StoryPlay } from "../src/lib/jl/sports/game-story.ts";
import {
  alertsToShow,
  athletePlaysIn,
  detectAlerts,
  scoreKind,
  toAlertGame,
  type FollowedAthlete,
} from "../src/lib/jl/sports/sports-alerts.ts";

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: "", logo: "", score: "", winner: false, ...extra };
}

const EAGLES = side("Philadelphia Eagles", { id: "21", nickname: "Eagles" });
const BEARS = side("Chicago Bears", { id: "3", nickname: "Bears" });

function nfl(
  state: SportsGame["state"],
  away: string,
  home: string,
  extra: Partial<SportsGame> = {},
): SportsGame {
  return {
    id: "401",
    league: "NFL",
    state,
    detail: state === "post" ? "Final" : "",
    away: { ...EAGLES, score: away },
    home: { ...BEARS, score: home },
    startMs: 0,
    ...extra,
  };
}

const td = (
  id: string,
  text: string,
  away: number,
  home: number,
  athleteIds: string[] = [],
): StoryPlay => ({
  id,
  side: "away",
  period: "Q2",
  clock: "3:00",
  kind: "Touchdown",
  text,
  away,
  home,
  athleteIds,
});

const SAQUON: FollowedAthlete = {
  league: "NFL",
  id: "3929630",
  name: "Saquon Barkley",
  teamId: "21",
};
const mine = { mine: true, top: false };

test("first snapshot: no alerts (opening the app does not replay the day)", () => {
  assert.deepEqual(detectAlerts(null, [toAlertGame(nfl("in", "7", "3"), mine)]), []);
});

test("your team: kick-off, a scoring play, the final", () => {
  const kick = detectAlerts(
    [toAlertGame(nfl("pre", "", ""), mine)],
    [toAlertGame(nfl("in", "0", "0"), mine)],
  );
  assert.deepEqual(
    kick.map((a) => [a.kind, a.title, a.mine]),
    [["kickoff", "Underway: Eagles at Bears", true]],
  );

  const before = toAlertGame(nfl("in", "7", "3"), {
    ...mine,
    plays: [td("1", "A. Brown 30 Yd pass", 7, 3)],
  });
  const after = toAlertGame(nfl("in", "14", "3"), {
    ...mine,
    plays: [td("1", "A. Brown 30 Yd pass", 7, 3), td("2", "D. Goedert 5 Yd pass", 14, 3)],
  });
  const score = detectAlerts([before], [after]);
  assert.equal(score.length, 1);
  assert.equal(score[0].title, "Eagles: Touchdown");
  assert.equal(score[0].text, "D. Goedert 5 Yd pass · Eagles 14–3 Bears");

  const fin = detectAlerts(
    [toAlertGame(nfl("in", "28", "7"), mine)],
    [toAlertGame(nfl("post", "28", "7"), mine)],
  );
  assert.equal(fin[0].kind, "final");
  assert.equal(fin[0].title, "Final: Eagles 28–7 Bears");
  assert.equal(fin[0].text, "Eagles rout Bears, 28–7");
});

test("your team without play-by-play: the score jump says what it was", () => {
  const a = detectAlerts(
    [toAlertGame(nfl("in", "7", "3"), mine)],
    [toAlertGame(nfl("in", "10", "3"), mine)],
  );
  assert.deepEqual(
    a.map((x) => [x.kind, x.title, x.text]),
    [["score", "Eagles: Field goal", "Eagles 10–3 Bears"]],
  );
  // A summary read only this time is not a new play: no double alert, the score jump is used.
  const b = detectAlerts(
    [toAlertGame(nfl("in", "7", "3"), mine)],
    [
      toAlertGame(nfl("in", "14", "3"), {
        ...mine,
        plays: [td("2", "D. Goedert 5 Yd pass", 14, 3)],
      }),
    ],
  );
  assert.deepEqual(
    b.map((x) => x.title),
    ["Eagles: Touchdown"],
  );
});

test("a followed athlete's play: one athlete alert, not also a team alert", () => {
  const prevPlays = [td("2", "D. Goedert 5 Yd pass", 14, 3)];
  const sb = td("3", "S.Barkley 12 Yd Run (J.Elliott Kick)", 21, 3);
  const opts = { ...mine, athletes: [SAQUON] };
  const a = detectAlerts(
    [toAlertGame(nfl("in", "14", "3"), { ...opts, plays: prevPlays })],
    [toAlertGame(nfl("in", "21", "3"), { ...opts, plays: [...prevPlays, sb] })],
  );
  assert.deepEqual(
    a.map((x) => [x.kind, x.title]),
    [["athlete", "Saquon Barkley: Touchdown"]],
  );
});

test("athlete plays match by ESPN id or by name, only on the athlete's team's games", () => {
  const g = nfl("in", "7", "0");
  assert.equal(
    athletePlaysIn(g, [td("1", "Run up the middle", 7, 0, ["3929630"])], [SAQUON]).length,
    1,
  );
  assert.equal(athletePlaysIn(g, [td("1", "Saquon Barkley 4 Yd Run", 7, 0)], [SAQUON]).length, 1);
  assert.equal(athletePlaysIn(g, [td("1", "J. Hurts 1 Yd Run", 7, 0)], [SAQUON]).length, 0);
  const other = { ...g, away: side("Dallas Cowboys", { id: "6" }) };
  assert.equal(
    athletePlaysIn(other, [td("1", "Saquon Barkley 4 Yd Run", 7, 0)], [SAQUON]).length,
    0,
  );
});

test("Top 10 games: kick-off, lead changes and the final, not every score", () => {
  const top = { mine: false, top: true };
  const g = (s: SportsGame["state"], a: string, h: string) => toAlertGame(nfl(s, a, h), top);
  assert.equal(
    detectAlerts([g("pre", "", "")], [g("in", "0", "0")])[0].text,
    "A Top 10 game is live now.",
  );
  // Extending a lead is not news.
  assert.deepEqual(detectAlerts([g("in", "7", "3")], [g("in", "14", "3")]), []);
  const lead = detectAlerts([g("in", "7", "10")], [g("in", "14", "10")]);
  assert.deepEqual(
    lead.map((x) => [x.kind, x.title, x.mine]),
    [["lead", "Eagles take the lead", false]],
  );
  assert.equal(
    detectAlerts([g("in", "7", "10")], [g("in", "10", "10")])[0].title,
    "Tied up: Eagles 10–10 Bears",
  );
  assert.equal(detectAlerts([g("in", "7", "10")], [g("post", "7", "10")])[0].kind, "final");
});

test("games that are neither yours nor Top 10 stay quiet", () => {
  const none = { mine: false, top: false };
  assert.deepEqual(
    detectAlerts([toAlertGame(nfl("pre", "", ""), none)], [toAlertGame(nfl("in", "7", "0"), none)]),
    [],
  );
});

test("basketball: lead changes only, even for your team; ties don't alert", () => {
  const nba = (a: string, h: string): SportsGame => ({
    id: "9",
    league: "NBA",
    state: "in",
    detail: "",
    away: side("Boston Celtics", { nickname: "Celtics", score: a }),
    home: side("Miami Heat", { nickname: "Heat", score: h }),
    startMs: 0,
  });
  assert.deepEqual(
    detectAlerts([toAlertGame(nba("50", "40"), mine)], [toAlertGame(nba("52", "40"), mine)]),
    [],
  );
  assert.deepEqual(
    detectAlerts([toAlertGame(nba("50", "48"), mine)], [toAlertGame(nba("50", "50"), mine)]),
    [],
  );
  assert.equal(
    detectAlerts([toAlertGame(nba("50", "49"), mine)], [toAlertGame(nba("50", "51"), mine)])[0]
      .title,
    "Heat takes the lead",
  );
});

test("score kinds by sport", () => {
  assert.equal(scoreKind("NFL", 7), "Touchdown");
  assert.equal(scoreKind("NCAAF", 3), "Field goal");
  assert.equal(scoreKind("EPL", 1), "Goal");
  assert.equal(scoreKind("MLB", 2), "2 runs score");
});

test("while the player is up, only your teams and athletes get through", () => {
  const alerts = [
    { id: "a", kind: "lead" as const, title: "", text: "", gameKey: "x", mine: false },
    { id: "b", kind: "score" as const, title: "", text: "", gameKey: "y", mine: true },
  ];
  assert.deepEqual(
    alertsToShow(alerts, { playerActive: true }).map((a) => a.id),
    ["b"],
  );
  assert.equal(alertsToShow(alerts, { playerActive: false }).length, 2);
});
