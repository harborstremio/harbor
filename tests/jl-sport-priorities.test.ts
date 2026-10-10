// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { rankGames } from "../src/lib/jl/sports/rank.ts";
import {
  DEFAULT_DAY_FOCUS,
  leaguesForToday,
  leagueWeight,
  moveLeague,
  normalizePriority,
  weekdayOf,
} from "../src/lib/jl/sports/sport-priorities.ts";
import type { SportsGame } from "../src/lib/sports/espn-types.ts";

const SATURDAY = new Date(2026, 9, 10, 12); // Sat 10 Oct 2026, local time
const SUNDAY = new Date(2026, 9, 11, 12);
const prefs = { priority: ["NCAAF", "NFL", "NBA"], dayFocus: DEFAULT_DAY_FOCUS };

const game = (id: string, league: string, over: Partial<SportsGame> = {}): SportsGame => ({
  id,
  league,
  state: "pre",
  detail: "",
  startMs: SATURDAY.getTime() + 3600_000,
  home: { id: `${id}h`, name: `${id} Home`, abbr: "H", logo: "", score: "", winner: false },
  away: { id: `${id}a`, name: `${id} Away`, abbr: "A", logo: "", score: "", winner: false },
  ...over,
});

test("weekday and today's order: the focus sport leads", () => {
  assert.equal(weekdayOf(SATURDAY), "Sat");
  assert.deepEqual(leaguesForToday(prefs, SATURDAY), ["NCAAF", "NFL", "NBA"]);
  assert.deepEqual(leaguesForToday({ ...prefs, priority: ["NBA", "NFL", "NCAAF"] }, SUNDAY), [
    "NFL",
    "NBA",
    "NCAAF",
  ]);
});

test("weights: focus beats order, switched-off sports get none", () => {
  assert.ok(
    (leagueWeight("NCAAF", prefs, SATURDAY) ?? 0) > (leagueWeight("NFL", prefs, SATURDAY) ?? 0),
  );
  assert.ok(
    (leagueWeight("NFL", prefs, SUNDAY) ?? 0) > (leagueWeight("NCAAF", prefs, SUNDAY) ?? 0),
  );
  assert.equal(leagueWeight("NHL", prefs, SATURDAY), null);
});

test("saved orders are cleaned; moving stays in bounds", () => {
  assert.deepEqual(normalizePriority(["NFL", "NFL", "XFL", 3, "NBA"]), ["NFL", "NBA"]);
  assert.equal(normalizePriority(null).length, 9);
  assert.deepEqual(moveLeague(["A", "B", "C"], "C", -1), ["A", "C", "B"]);
  assert.deepEqual(moveLeague(["A", "B"], "A", -1), ["A", "B"]);
});

test("Top 10: Saturday college first, other sports out unless it's your team", () => {
  const ranked = rankGames(
    [game("nfl", "NFL"), game("cfb", "NCAAF"), game("nhl", "NHL"), game("mine", "NHL")],
    [{ league: "NHL", id: "mineh", name: "mine Home" }],
    { now: SATURDAY, prefs },
  );
  assert.deepEqual(
    ranked.map((r) => r.game.id),
    ["mine", "cfb", "nfl"],
  );
});
