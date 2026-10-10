// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  espnTeamLogo,
  leagueFitsSport,
  leagueSport,
  slotLeague,
} from "../src/lib/jl/sports/sport-art.ts";
import { wordmarkAccent, wordmarkLines } from "../src/lib/jl/sports/team-look.ts";

test("wordmark lines: school or city on top, nickname below", () => {
  assert.deepEqual(wordmarkLines({ name: "Oregon Ducks", location: "Oregon", nickname: "Ducks" }), [
    "OREGON",
    "DUCKS",
  ]);
  assert.deepEqual(wordmarkLines({ name: "Kansas City Chiefs", location: "Kansas City" }), [
    "KANSAS CITY",
    "CHIEFS",
  ]);
  assert.deepEqual(wordmarkLines({ name: "Golden State Warriors" }), ["GOLDEN STATE", "WARRIORS"]);
  assert.deepEqual(wordmarkLines({ name: "Liverpool" }), ["LIVERPOOL", ""]);
});

test("wordmark accent: the team's bright colour, else the theme accent", () => {
  assert.equal(wordmarkAccent({ primary: "154733", secondary: "fee123" }), "fee123");
  assert.equal(wordmarkAccent({ primary: "041e42", secondary: "000000" }), null);
});

test("sport art helpers: league sports, college cards, slots and logos", () => {
  assert.equal(leagueSport("NCAAF"), "football");
  assert.ok(leagueFitsSport("NCAAB", "college"));
  assert.ok(!leagueFitsSport("NBA", "college"));
  assert.ok(leagueFitsSport("NBA", "basketball"));
  assert.equal(slotLeague("NCAAF 03"), "NCAAF");
  assert.equal(slotLeague(null), null);
  assert.equal(
    espnTeamLogo("NCAAF", "2483"),
    "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
  );
  assert.equal(espnTeamLogo("F1", "1"), null);
});
