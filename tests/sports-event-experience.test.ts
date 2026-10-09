import test from "node:test";
import assert from "node:assert/strict";
import { parseFightInfo, scheduleEvents } from "../src/lib/sports/fight-card.ts";
import { parseFootballDepth, basketballFive } from "../src/lib/sports/field-lineups.ts";
import { parseMarketOdds } from "../src/lib/sports/market-odds.ts";
import type { SportsGame, MatchPlayer } from "../src/lib/sports/espn-types.ts";
const game = {
  id: "e|b",
  league: "UFC",
  startMs: Date.parse("2026-09-19T23:00Z"),
  state: "pre",
  detail: "",
  home: { id: "a", name: "Joshua Van", abbr: "", logo: "", score: "", winner: false },
  away: { id: "b", name: "Alexandre Pantoja", abbr: "", logo: "", score: "", winner: false },
  context: { id: "e", name: "UFC 331", round: "", draw: "", venue: "", major: false },
} satisfies SportsGame;
test("fight cards retain each distinct bout while grouping their parent once", () => {
  const groups = scheduleEvents([
    game,
    { ...game, id: "e|c" },
    game,
    { ...game, id: "other|d", context: { ...game.context, id: "other" } },
  ]);
  assert.deepEqual(
    groups.map((g) => g.length),
    [2, 1],
  );
  assert.equal(
    parseFightInfo({ cardSegment: { name: "prelims2" }, matchNumber: 13 }).section,
    "Early prelims",
  );
  assert.equal(parseFightInfo({ cardSegment: { description: "Main Card" } }).section, "Main card");
  assert.equal(parseFightInfo({}).section, "Fight card");
});
test("depth charts use provider names and no more than eleven players", () => {
  const positions = Object.fromEntries(
    ["qb", "rb", "fb", "wr1", "wr2", "wr3", "lt", "lg", "c", "rg", "rt", "te"].map((slot) => [
      slot,
      {
        athletes: [{ id: slot, displayName: slot }],
        position: { abbreviation: slot.toUpperCase() },
      },
    ]),
  );
  const depth = parseFootballDepth({ season: { year: 2026 }, depthchart: [{ positions }] });
  assert.equal(depth.offense.length, 11);
  assert.equal(depth.defense.length, 0);
  assert.equal(depth.year, 2026);
  assert.equal(depth.offense.find((p) => p.slot === "QB")?.player?.name, "qb");
});
test("basketball excludes bench players and never repeats starters to fill missing positions", () => {
  const p = (id: string, starter: boolean) =>
    ({
      id,
      name: id,
      starter,
      position: "G",
      jersey: "",
      goals: 0,
      yellowCards: 0,
      redCards: 0,
    }) as MatchPlayer;
  const five = basketballFive([p("one", true), p("two", true), p("bench", false)]);
  assert.equal(five.filter((p) => p.player).length, 2);
  assert.deepEqual(
    five.flatMap((p) => (p.player ? [p.player.id] : [])),
    ["one", "two"],
  );
});
test("market odds require both fighters and fixture time; malformed, stale and closed markets are excluded", () => {
  const market = {
    sportsMarketType: "moneyline",
    gameStartTime: "2026-09-19T23:00Z",
    question: "Joshua Van vs. Alexandre Pantoja",
    slug: "van-pantoja",
    outcomes: '["Joshua Van","Alexandre Pantoja"]',
    outcomePrices: '["0.6","0.4"]',
  };
  const raw = (m: any) => ({ events: [{ title: market.question, markets: [m] }] });
  assert.equal(parseMarketOdds(raw(market), game).length, 1);
  for (const patch of [
    { gameStartTime: "2025-09-19T23:00Z" },
    { gameStartTime: undefined },
    { closed: true },
    { outcomePrices: '["bad","0.4"]' },
    { outcomePrices: '["1.4","-0.4"]' },
  ])
    assert.equal(parseMarketOdds(raw({ ...market, ...patch }), game).length, 0);
  assert.equal(
    parseMarketOdds(raw(market), { ...game, away: { ...game.away, name: "Pat Brown" } }).length,
    0,
  );
});
