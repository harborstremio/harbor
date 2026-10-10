import test from "node:test";
import assert from "node:assert/strict";
import { esportsTeamLeague } from "../src/lib/sports/esports-team-identity.ts";
import type { EsportsMatch } from "../src/lib/sports/esports-feeds.ts";
const match = (game: EsportsMatch["game"], name: string) =>
  ({ game, event: { name } }) as EsportsMatch;

test("League of Legends squad enrichment requires a known, unambiguous league", () => {
  assert.equal(esportsTeamLeague("lol", [match("lol", "LCK · Playoffs")]), "LCK");
  assert.equal(esportsTeamLeague("lol", [match("lol", "LEC · Finals")]), "LEC");
  assert.equal(esportsTeamLeague("lol", [match("lol", "Worlds")]), undefined);
  assert.equal(
    esportsTeamLeague("lol", [match("lol", "LCK · Playoffs"), match("lol", "LEC · Finals")]),
    undefined,
  );
});
test("Never transfer a competition identity to another esports squad", () => {
  assert.equal(esportsTeamLeague("valorant", [match("lol", "LCK")]), undefined);
  assert.equal(esportsTeamLeague("cs2", [match("cs2", "LCK")]), undefined);
  assert.equal(
    esportsTeamLeague("rocketleague", [match("rocketleague", "RLCS 2026 · Finals")]),
    "RLCS",
  );
  assert.equal(
    esportsTeamLeague("rocketleague", [match("rocketleague", "Esports World Cup")]),
    undefined,
  );
});
