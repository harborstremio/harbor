import assert from "node:assert/strict";
import test from "node:test";
import type { SportsGame, SportsSide } from "../src/lib/sports/espn.ts";
import { toGame, type AsGame, type AsGet, type AsTeam } from "../src/lib/jl/sports/as-core.ts";
import {
  asSportForEspnPath,
  findAsMatch,
  normalizeName,
  pickAsMatch,
  searchDays,
  sideScore,
} from "../src/lib/jl/sports/as-match-map.ts";

const side = (name: string, extra: Partial<SportsSide> = {}): SportsSide => ({
  name,
  abbr: "",
  logo: "",
  score: "",
  winner: false,
  ...extra,
});
const team = (name: string, short = name, code = ""): AsTeam => ({
  id: 1,
  name,
  short,
  code,
  score: null,
  color: null,
});
const START = Date.parse("2026-10-10T19:30:00Z");
const espn = (home: SportsSide, away: SportsSide): SportsGame => ({
  id: "1",
  league: "EPL",
  state: "pre",
  detail: "",
  home,
  away,
  startMs: START,
});
const asEvent = (id: number, home: string, away: string, t = START) => ({
  id,
  startTimestamp: t / 1000,
  status: { type: "notstarted" },
  homeTeam: { id: id * 10, name: home },
  awayTeam: { id: id * 10 + 1, name: away },
});
const game = (id: number, home: string, away: string, t = START) =>
  toGame(asEvent(id, home, away, t), "football") as AsGame;

test("ESPN sport → AllSports sport", () => {
  assert.equal(asSportForEspnPath("soccer/eng.1"), "football");
  assert.equal(asSportForEspnPath("football/nfl"), "american-football");
  assert.equal(asSportForEspnPath("hockey/nhl"), "ice-hockey");
  assert.equal(asSportForEspnPath("mma/ufc"), null);
  assert.equal(asSportForEspnPath(null), null);
});

test("team names", () => {
  assert.equal(normalizeName("Atlético de Madrid"), "atletico madrid");
  assert.equal(normalizeName("Brighton & Hove Albion FC"), "brighton and hove albion");
  assert.equal(sideScore(side("Arsenal"), team("Arsenal FC")), 1);
  assert.ok(sideScore(side("Wolverhampton Wanderers"), team("Wolverhampton", "Wolves")) >= 0.6);
  assert.equal(
    sideScore(
      side("Kansas City Chiefs", { location: "Kansas City", nickname: "Chiefs" }),
      team("Kansas City Chiefs", "Chiefs", "KC"),
    ),
    1,
  );
  assert.ok(sideScore(side("Manchester United"), team("Manchester City")) < 0.6);
});

test("pick the game: both sides, close in time, swapped sides allowed", () => {
  const g = espn(side("Arsenal"), side("Tottenham Hotspur"));
  const list = [
    game(1, "Arsenal", "Chelsea"),
    game(2, "Arsenal", "Tottenham Hotspur"),
    game(3, "Arsenal", "Tottenham Hotspur", START + 3 * 86400_000),
  ];
  assert.equal(pickAsMatch(g, list)?.id, 2);
  assert.equal(pickAsMatch(g, [game(4, "Tottenham Hotspur", "Arsenal")])?.id, 4);
  assert.equal(pickAsMatch(g, [game(5, "Arsenal Women", "Tottenham Hotspur Women")]), null);
  assert.equal(pickAsMatch(g, [game(6, "Arsenal U21", "Tottenham Hotspur U21")]), null);
});

test("look in the game's day, then the nearest neighbouring day", async () => {
  const days = searchDays(START).map((d) => d.toISOString().slice(0, 10));
  assert.deepEqual(days, ["2026-10-10", "2026-10-11"]);
  const asked: string[] = [];
  const get = (async (p: string) => {
    asked.push(p);
    return p === "/api/matches/11/10/2026"
      ? { events: [asEvent(9, "Arsenal", "Tottenham Hotspur")] }
      : { events: [] };
  }) as AsGet;
  const found = await findAsMatch(
    get,
    espn(side("Arsenal"), side("Tottenham Hotspur")),
    "soccer/eng.1",
  );
  assert.equal(found?.id, 9);
  assert.deepEqual(asked, ["/api/matches/10/10/2026", "/api/matches/11/10/2026"]);
  assert.equal(await findAsMatch(get, espn(side("A"), side("B")), "mma/ufc"), null);
});
