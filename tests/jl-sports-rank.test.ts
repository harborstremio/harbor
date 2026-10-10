import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import { isFavoriteSide, rankGames, type JlFavoriteTeam } from "../src/lib/jl/sports/rank.ts";

function side(name: string, extra: Partial<SportsSide> = {}): SportsSide {
  return { name, abbr: name.slice(0, 3).toUpperCase(), logo: "", score: "", winner: false, ...extra };
}

function game(id: string, league: string, away: SportsSide, home: SportsSide, extra: Partial<SportsGame> = {}): SportsGame {
  return { id, league, state: "pre", detail: "", away, home, startMs: 0, ...extra };
}

// Saturday 12:00 PT.
const SAT_NOON_PT = new Date("2026-09-26T19:00:00Z");
const at = (iso: string) => Date.parse(iso);

const SATURDAY: SportsGame[] = [
  game("1", "NCAAF", side("Presbyterian Blue Hose"), side("Marist Red Foxes"), {
    state: "in",
    startMs: at("2026-09-26T16:00:00Z"),
  }),
  game("2", "NCAAF", side("Texas Longhorns", { rank: 1 }), side("Tennessee Volunteers", { rank: 14 }), {
    state: "in",
    startMs: at("2026-09-26T16:00:00Z"),
    network: "ABC",
  }),
  game("3", "NCAAF", side("Iowa Hawkeyes", { rank: 17 }), side("Michigan Wolverines", { rank: 18 }), {
    startMs: at("2026-09-26T19:30:00Z"),
  }),
  game("4", "NCAAF", side("Portland State Vikings", { id: "2502" }), side("Weber State Wildcats"), {
    startMs: at("2026-09-27T00:00:00Z"),
  }),
  game("5", "NCAAF", side("Ohio Bobcats"), side("Kent State Golden Flashes"), {
    state: "post",
    startMs: at("2026-09-26T15:00:00Z"),
  }),
];

test("Saturday: a live #1 vs #14 on national TV leads; ranked matchups beat unranked", () => {
  const top = rankGames(SATURDAY, [], { now: SAT_NOON_PT });
  assert.equal(top[0].game.id, "2");
  const labels = top[0].reasons.map((r) => r.label);
  assert.ok(labels.includes("#{a} vs #{b}") && labels.includes("Live") && labels.includes("On {network}"));
  const order = top.map((r) => r.game.id);
  assert.ok(order.indexOf("3") < order.indexOf("1"));
});

test("finished games drop out", () => {
  const top = rankGames(SATURDAY, [], { now: SAT_NOON_PT });
  assert.ok(!top.some((r) => r.game.id === "5"));
});

test("your team jumps past unranked games and is flagged as yours", () => {
  const favs: JlFavoriteTeam[] = [{ league: "NCAAF", id: "2502", name: "Portland State Vikings" }];
  const without = rankGames(SATURDAY, [], { now: SAT_NOON_PT }).map((r) => r.game.id);
  const top = rankGames(SATURDAY, favs, { now: SAT_NOON_PT });
  const order = top.map((r) => r.game.id);
  assert.ok(without.indexOf("4") > without.indexOf("1"));
  assert.ok(order.indexOf("4") < order.indexOf("1"));
  const mine = top.find((r) => r.game.id === "4");
  assert.equal(mine?.mine, true);
  assert.ok(mine?.reasons.some((r) => r.label === "Your team"));
});

test("Sunday favours the NFL over college", () => {
  const sun = new Date("2026-09-27T17:30:00Z");
  const games = [
    game("nfl", "NFL", side("Seattle Seahawks"), side("San Francisco 49ers"), { startMs: at("2026-09-27T17:25:00Z") }),
    game("cfb", "NCAAF", side("Presbyterian Blue Hose"), side("Marist Red Foxes"), { startMs: at("2026-09-27T17:00:00Z") }),
  ];
  assert.equal(rankGames(games, [], { now: sun })[0].game.id, "nfl");
});

test("a close line outranks a blowout line", () => {
  const games = [
    game("close", "NFL", side("A Team"), side("B Team"), { startMs: at("2026-09-27T20:00:00Z"), odds: "KC -2.5 · O/U 47.5" }),
    game("wide", "NFL", side("C Team"), side("D Team"), { startMs: at("2026-09-27T20:00:00Z"), odds: "BUF -14.5 · O/U 41" }),
  ];
  const top = rankGames(games, [], { now: new Date("2026-09-27T17:30:00Z") });
  assert.equal(top[0].game.id, "close");
  assert.ok(top[0].reasons.some((r) => r.label === "Close line"));
});

test("a watchable game wins a tie", () => {
  const games = [
    game("a", "NBA", side("A Team"), side("B Team"), { startMs: at("2026-09-27T20:00:00Z") }),
    game("b", "NBA", side("C Team"), side("D Team"), { startMs: at("2026-09-27T20:00:00Z") }),
  ];
  const top = rankGames(games, [], { now: new Date("2026-09-27T17:30:00Z"), watchable: (g) => g.id === "b" });
  assert.equal(top[0].game.id, "b");
});

test('"Your team": Ohio is not Ohio State; Oregon is Oregon Ducks; ids beat names; leagues stay separate', () => {
  const favs: JlFavoriteTeam[] = [
    { league: "NCAAF", id: "194", name: "Ohio State Buckeyes" },
    { league: "NCAAF", id: "2483", name: "Oregon Ducks" },
  ];
  assert.equal(isFavoriteSide({ name: "Ohio" }, "NCAAF", favs), false);
  assert.equal(isFavoriteSide({ name: "Ohio St." }, "NCAAF", favs), true);
  assert.equal(isFavoriteSide({ name: "Oregon" }, "NCAAF", favs), true);
  assert.equal(isFavoriteSide({ name: "Oregon State" }, "NCAAF", favs), false);
  assert.equal(isFavoriteSide({ name: "Ohio", id: "195" }, "NCAAF", favs), false);
  assert.equal(isFavoriteSide({ name: "Oregon Ducks", id: "2483" }, "NCAAF", favs), true);
  assert.equal(isFavoriteSide({ name: "Oregon", location: "Oregon" }, "NFL", favs), false);
});
