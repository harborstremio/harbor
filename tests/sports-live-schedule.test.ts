import test from "node:test";
import assert from "node:assert/strict";
import {
  currentLiveGames,
  liveDateRange,
  liveScoreboardKeys,
} from "../src/lib/sports/live-schedule.ts";
import { LEAGUES } from "../src/lib/sports/espn-leagues.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

test("live discovery covers nonfavorite scoreboards once and excludes schedule-only providers", () => {
  const base = LEAGUES[0];
  const keys = liveScoreboardKeys([
    ...LEAGUES,
    { ...base, key: "NBA_COPY", group: "basketball", path: "basketball/nba" },
    { ...base, key: "EGYPT", path: "4829" },
    { ...base, key: "ONE", path: "official-one" },
    { ...base, key: "ESPORTS", group: "esports", path: "test/esports" },
  ]);
  assert.equal(keys.filter((key) => key === "SOCCER_ALL").length, 1);
  for (const league of LEAGUES.filter(
    (l) => l.group !== "soccer" && l.group !== "esports" && l.path.includes("/"),
  ))
    assert.ok(keys.includes(league.key), league.key);
  for (const key of ["NBA_COPY", "EGYPT", "ONE", "ESPORTS", "EPL"])
    assert.ok(!keys.includes(key), key);
});

test("live dates span local midnight and the entire current local day", () => {
  for (const day of ["20260101", "20260308", "20260913", "20261101"]) {
    const [from, through] = liveDateRange(day).split("-");
    const midnight = new Date(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8));
    const prior = new Date(midnight);
    prior.setDate(prior.getDate() - 1);
    const end = new Date(midnight);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    const stamp = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
    assert.ok(from <= stamp(prior));
    assert.ok(through >= stamp(end));
  }
});

test("live-only excludes stale live labels, scheduled and completed games without using kickoff as live evidence", () => {
  const game = { id: "current", state: "in", startMs: 0 } as SportsGame;
  assert.deepEqual(
    currentLiveGames([
      game,
      { ...game, id: "stale", savedAt: Date.now() },
      { ...game, id: "future", state: "pre" },
      { ...game, id: "ended", state: "post" },
    ]).map((g) => g.id),
    ["current"],
  );
});
