import test from "node:test";
import assert from "node:assert/strict";
import { esportsTeamDirectory } from "../src/lib/sports/esports-team-directory.ts";
import type { EsportsMatch } from "../src/lib/sports/esports-feeds.ts";

test("ranked teams lead without scheduled matches; participants merge by game and provider ID", () => {
  const match = {
    id: "series",
    game: "cs2",
    teams: [
      { id: "2", name: "Second", logo: "second" },
      { id: "99", name: "Qualifier" },
    ],
  } as EsportsMatch;
  const ranked = [
    { id: "2", name: "Second", rank: 2, logo: "", players: [] },
    { id: "1", name: "First", rank: 1, logo: "first", players: [] },
  ];
  const result = esportsTeamDirectory(
    [match, match, { ...match, id: "other", game: "valorant" }],
    ranked,
  );
  assert.deepEqual(
    result.map((team) => `${team.game}:${team.id}`),
    ["cs2:1", "cs2:2", "cs2:99", "valorant:2", "valorant:99"],
  );
  assert.equal(result[0].matches.length, 0);
  assert.equal(result[1].matches.length, 1);
  assert.equal(result[1].logo, "second");
  assert.equal(result[1].ranking?.rank, 2);
});
