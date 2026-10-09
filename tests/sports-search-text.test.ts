import test from "node:test";
import assert from "node:assert/strict";
import { matchesTeamSearch, normalizeSportsSearch } from "../src/lib/sports/search-text.ts";

test("Brazilian team searches accept omitted accents and punctuation", () => {
  assert.equal(matchesTeamSearch({ name: "São Paulo", abbr: "SAO" }, "sao paulo"), true);
  assert.equal(matchesTeamSearch({ name: "Grêmio", abbr: "GRE" }, " Gremio "), true);
  assert.equal(normalizeSportsSearch("Atlético-MG"), "atletico mg");
  assert.equal(matchesTeamSearch({ name: "Flamengo", abbr: "FLA" }, "Fluminense"), false);
});

test("Arabic searches retain letters and match reported aliases without vowel marks", () => {
  const team = { name: "Al Hilal", abbr: "HIL", aliases: ["الهِلَال"] };
  assert.equal(matchesTeamSearch(team, "الهلال"), true);
  assert.equal(matchesTeamSearch(team, "الهــلال"), true);
  assert.equal(normalizeSportsSearch("الأهلي"), normalizeSportsSearch("الاهلي"));
  assert.equal(matchesTeamSearch(team, "النصر"), false);
});
