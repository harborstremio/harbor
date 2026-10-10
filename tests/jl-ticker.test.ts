// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn-types.ts";
import {
  TICKER_OFF_MS,
  TICKER_ON_MS,
  msToTickerFlip,
  selectTickerGames,
  tickerExtras,
  tickerOnAt,
  tickerStatus,
  tickerTeamName,
} from "../src/lib/jl/sports/ticker.ts";

const NOW = new Date(2026, 9, 10, 15, 0).getTime();
const HOUR = 3600000;

function side(id: string, name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { id, name, abbr: id.toUpperCase(), logo: "", score: "0", winner: false, ...extra };
}

function game(id: string, extra: Partial<SportsGame> = {}): SportsGame {
  return {
    id,
    league: "NFL",
    state: "pre",
    detail: "",
    away: side(`a${id}`, `Away ${id}`),
    home: side(`h${id}`, `Home ${id}`),
    startMs: NOW + HOUR,
    ...extra,
  };
}

test("schedule: five minutes on, three off, by the wall clock", () => {
  const cycle = TICKER_ON_MS + TICKER_OFF_MS;
  assert.equal(tickerOnAt(0), true);
  assert.equal(tickerOnAt(TICKER_ON_MS - 1), true);
  assert.equal(tickerOnAt(TICKER_ON_MS), false);
  assert.equal(tickerOnAt(cycle - 1), false);
  assert.equal(tickerOnAt(cycle), true);
  assert.equal(msToTickerFlip(0), TICKER_ON_MS);
  assert.equal(msToTickerFlip(TICKER_ON_MS + 1000), TICKER_OFF_MS - 1000);
  assert.equal(tickerOnAt(10 * cycle + 1000) && tickerOnAt(1000), true);
});

test("selection: live games, today's kick-offs and finals; nothing from other days", () => {
  const games = [
    game("tomorrow", { startMs: NOW + 30 * HOUR }),
    game("yesterday", { state: "post", startMs: NOW - 30 * HOUR }),
    game("final", { state: "post", startMs: NOW - 4 * HOUR }),
    game("later", { startMs: NOW + 2 * HOUR }),
    game("live", { state: "in", startMs: NOW - 30 * HOUR }),
    game("live", { state: "in", startMs: NOW - 30 * HOUR }),
  ];
  const ids = selectTickerGames(games, [], NOW).map((g) => g.game.id);
  assert.deepEqual(ids, ["live", "final", "later"]);
});

test("order: followed teams first, then live, then start time; capped", () => {
  const games = [
    game("early", { startMs: NOW - HOUR, state: "post" }),
    game("live", { state: "in", startMs: NOW - 2 * HOUR }),
    game("mine", { startMs: NOW + 3 * HOUR, home: side("12", "Kansas City Chiefs") }),
  ];
  const favorites = [{ league: "NFL", id: "12", name: "Kansas City Chiefs" }];
  const picked = selectTickerGames(games, favorites, NOW);
  assert.deepEqual(
    picked.map((g) => [g.game.id, g.mine]),
    [
      ["mine", true],
      ["live", false],
      ["early", false],
    ],
  );
  const many = Array.from({ length: 60 }, (_, i) => game(`g${i}`, { startMs: NOW + i * 60000 }));
  assert.equal(selectTickerGames(many, [], NOW).length, 40);
  assert.equal(selectTickerGames(many, [], NOW, 5).length, 5);
});

test("status: live detail, final, or kick-off time", () => {
  assert.deepEqual(tickerStatus(game("1", { state: "in", detail: "Q3 4:17" })), {
    kind: "live",
    detail: "Q3 4:17",
  });
  assert.deepEqual(tickerStatus(game("1", { state: "post", detail: "Final/OT" })), {
    kind: "final",
    detail: "Final/OT",
  });
  assert.deepEqual(tickerStatus(game("1")), { kind: "time", startMs: NOW + HOUR });
});

test("names: school for college, nickname for pro, name elsewhere", () => {
  const osu = side("194", "Ohio State Buckeyes", { location: "Ohio State", nickname: "Buckeyes" });
  assert.equal(tickerTeamName(osu, "NCAAF"), "Ohio State");
  const kc = side("12", "Kansas City Chiefs", { location: "Kansas City", nickname: "Chiefs" });
  assert.equal(tickerTeamName(kc, "NFL"), "Chiefs");
  assert.equal(tickerTeamName(side("ars", "Arsenal"), "EPL"), "Arsenal");
});

test("extras: network for upcoming games, odds only when allowed", () => {
  const g = game("1", { network: "CBS", odds: "KC -3.5" });
  assert.deepEqual(tickerExtras(g, false), ["CBS"]);
  assert.deepEqual(tickerExtras(g, true), ["CBS", "KC -3.5"]);
  assert.deepEqual(tickerExtras({ ...g, state: "in" }, true), []);
});
