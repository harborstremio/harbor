import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogTeams, createTeamCatalog } from "../src/lib/sports/team-catalog.ts";
import { matchesTeamSearch } from "../src/lib/sports/search-text.ts";

// Names and provider IDs captured from ESPN's real Saudi directory; Arabic identities are SPL's own labels.
const rows = [
  { id: "929", displayName: "Al Hilal", abbreviation: "HIL" },
  { id: "817", displayName: "Al Nassr", abbreviation: "NSR" },
  { id: "8346", displayName: "Al Ahli", abbreviation: "AHL" },
  { id: "2276", displayName: "Al Ittihad", abbreviation: "ITT" },
];
const raw = { sports: [{ leagues: [{ teams: rows.map((team) => ({ team })) }] }] };
const league = { key: "ROSHN", group: "soccer", path: "soccer/ksa.1" };

test("official Saudi Arabic aliases match real ESPN teams, including Arabic vowel marks", () => {
  const teams = parseCatalogTeams(raw, league);
  for (const [query, expected] of [
    ["الهلال", "929"],
    ["النصر", "817"],
    ["الأَهْلِي", "8346"],
    ["الاتحاد", "2276"],
  ]) {
    assert.deepEqual(
      teams.filter((team) => matchesTeamSearch(team, query)).map((team) => team.id),
      [expected],
    );
  }
  assert.equal(teams.find((team) => team.id === "929")?.name, "Al Hilal");
  const unrelated = parseCatalogTeams(raw, { ...league, key: "EGYPT" });
  assert.equal(
    unrelated.some((team) => matchesTeamSearch(team, "الهلال")),
    false,
  );
});

test("existing persisted Saudi catalogs gain aliases without waiting for their cache TTL", () => {
  const oldTeams = parseCatalogTeams(raw, league).map(({ aliases: _aliases, ...team }) => team);
  const catalog = createTeamCatalog({
    read: () => JSON.stringify([{ key: "ROSHN", at: Date.now() - 1000, teams: oldTeams }]),
    request: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(
    catalog.cached("ROSHN").filter((team) => matchesTeamSearch(team, "النصر"))[0].name,
    "Al Nassr",
  );
});
