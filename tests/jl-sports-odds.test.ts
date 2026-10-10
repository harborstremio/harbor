// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import {
  applyOddsLines,
  findOddsLine,
  formatOddsLine,
  oddsLeaguesFor,
  oddsSportKey,
  parseOddsCache,
  parseOddsEvents,
} from "../src/lib/jl/sports/odds-api.ts";

function side(name: string, abbr: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr, logo: "", score: "", winner: false, ...extra };
}

const START = Date.parse("2026-10-11T17:00:00Z");
const game: SportsGame = {
  id: "1",
  league: "NFL",
  state: "pre",
  detail: "",
  away: side("Buffalo Bills", "BUF", { location: "Buffalo", nickname: "Bills" }),
  home: side("Kansas City Chiefs", "KC", { location: "Kansas City", nickname: "Chiefs" }),
  startMs: START,
  odds: "KC -3 · O/U 47.5",
};

const body = [
  {
    home_team: "Kansas City Chiefs",
    away_team: "Buffalo Bills",
    commence_time: "2026-10-11T17:00:00Z",
    bookmakers: [
      {
        key: "smallbook",
        markets: [{ key: "h2h", outcomes: [{ name: "Kansas City Chiefs", price: -999 }] }],
      },
      {
        key: "draftkings",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Kansas City Chiefs", price: -180 },
              { name: "Buffalo Bills", price: 150 },
            ],
          },
          {
            key: "spreads",
            outcomes: [
              { name: "Kansas City Chiefs", point: -3.5, price: -110 },
              { name: "Buffalo Bills", point: 3.5, price: -110 },
            ],
          },
        ],
      },
    ],
  },
  { home_team: "", away_team: "x", commence_time: "bad" },
];

test("league keys map to The Odds API sports", () => {
  assert.equal(oddsSportKey("NFL"), "americanfootball_nfl");
  assert.equal(oddsSportKey("NOPE"), null);
  assert.deepEqual(oddsLeaguesFor([game, { ...game, league: "NBA", state: "post" }, { ...game, league: "MLB" }]), ["MLB", "NFL"]);
});

test("events parse with the big US books preferred", () => {
  const lines = parseOddsEvents(body);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].moneyline, { "Kansas City Chiefs": -180, "Buffalo Bills": 150 });
  assert.deepEqual(lines[0].spread, { team: "Kansas City Chiefs", point: -3.5 });
  assert.deepEqual(parseOddsEvents(null), []);
});

test("lines match both teams near kick-off and format with card abbreviations", () => {
  const lines = parseOddsEvents(body);
  const line = findOddsLine(game, lines);
  assert.ok(line);
  assert.equal(formatOddsLine(game, line!), "KC −3.5 · ML BUF +150 / KC −180");
  assert.equal(findOddsLine({ ...game, startMs: START + 2 * 86400000 }, lines), null);
  assert.equal(findOddsLine({ ...game, away: side("Denver Broncos", "DEN") }, lines), null);
});

test("soccer three-way lines include the draw", () => {
  const g: SportsGame = { ...game, league: "EPL", away: side("Chelsea", "CHE"), home: side("Arsenal", "ARS") };
  const label = formatOddsLine(g, {
    home: "Arsenal",
    away: "Chelsea",
    startMs: START,
    moneyline: { Arsenal: -120, Chelsea: 300, Draw: 250 },
    spread: null,
  });
  assert.equal(label, "ML CHE +300 / ARS −120 / Draw +250");
});

test("games without a matching line keep ESPN's odds", () => {
  const lines = parseOddsEvents(body);
  const other = { ...game, id: "2", home: side("Denver Broncos", "DEN") };
  const out = applyOddsLines([game, other, { ...game, id: "3", league: "NBA" }], { NFL: lines });
  assert.equal(out[0].odds, "KC −3.5 · ML BUF +150 / KC −180");
  assert.equal(out[1].odds, game.odds);
  assert.equal(out[2].odds, game.odds);
});

test("stored odds drop expired entries", () => {
  const raw = JSON.stringify({ NFL: { lines: [], expires: 10 }, NBA: { lines: [], expires: 1 }, X: { expires: 99 } });
  assert.deepEqual(Object.keys(parseOddsCache(raw, 5)), ["NFL"]);
  assert.deepEqual(parseOddsCache("nope", 0), {});
});
