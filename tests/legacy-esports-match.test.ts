import assert from "node:assert/strict";
import test from "node:test";
import { legacyEsportsMatch } from "../src/lib/sports/legacy-esports-match";
import { ESPORTS_GAMES } from "../src/lib/sports/esports-catalog";
import { esportsExternalUrl, officialBroadcastSource } from "../src/lib/sports/esports-streams";
const base: any = {
  id: "12345678",
  league: "DOTA2",
  state: "in",
  startMs: 1789387200000,
  home: { id: "1", name: "Cooman Club", abbr: "COO", logo: "", score: "13" },
  away: { id: "2", name: "Rostik999 Club", abbr: "ROS", logo: "", score: "17" },
  context: { id: "x", name: "Winline Star Series" },
};
test("OpenDota routing preserves exact match identity and does not invent broadcasts", () => {
  const result = legacyEsportsMatch(base)!;
  assert.equal(result.game, "dota2");
  assert.equal(result.sourceUrl, "https://www.opendota.com/matches/12345678");
  assert.deepEqual(result.streams, []);
  assert.equal(result.teams[0].score, 13);
  assert.equal(result.teams[1].name, "Rostik999 Club");
});
test("every scheduled esports alias routes to the esports viewer; regular sports remain separate", () => {
  for (const league of ["DOTA2", "CS2", "CSGO", "LOL", "LCK", "LEC", "LPL", "VALORANT", "RLCS"])
    assert.ok(legacyEsportsMatch({ ...base, league }), league);
  assert.equal(legacyEsportsMatch({ ...base, league: "NFL" }), null);
});
test("all offered games have valid official discovery and broadcast destinations", () => {
  for (const game of ESPORTS_GAMES) {
    assert.ok(esportsExternalUrl(game.officialUrl), game.id);
    assert.ok(game.broadcasts.length, game.id);
    for (const stream of game.broadcasts)
      assert.ok(officialBroadcastSource(stream), `${game.id}: ${stream.url}`);
  }
});
