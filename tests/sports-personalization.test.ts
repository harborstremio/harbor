import assert from "node:assert/strict";
import test from "node:test";
import type { LeagueDef, SportsGame } from "../src/lib/sports/espn-types";
import {
  selectedSportsLeagues,
  sportsSelectionScope,
  gamesInSportsSelection,
} from "../src/lib/sports/personalization.ts";

const league = (key: string, group: string): LeagueDef => ({
  key,
  tag: key,
  group,
  path: key,
  label: key,
  labelEn: key,
  logo: "",
});
const catalog = [
  league("NBA", "basketball"),
  league("WNBA", "basketball"),
  league("EPL", "soccer"),
  league("SERIEA", "soccer"),
  league("UFC", "combat"),
  league("NHL", "hockey"),
];
test("saved selections replace starter leagues; an explicit empty choice stays empty", () => {
  assert.deepEqual(selectedSportsLeagues(catalog, ["NHL", "NHL", "unknown"], false, ["NBA"]), [
    "NHL",
  ]);
  assert.deepEqual(selectedSportsLeagues(catalog, [], false, ["NBA"]), ["NBA"]);
  assert.deepEqual(selectedSportsLeagues(catalog, [], true, ["NBA"]), []);
});
test("personal sport and league filters only expose selected leagues, including sports outside old fixed shortcuts", () => {
  const scope = sportsSelectionScope(catalog, ["NHL", "NBA", "EPL"], "basketball", false, "WNBA");
  assert.deepEqual([...scope.groups], ["basketball", "soccer", "hockey"]);
  assert.deepEqual(scope.leagues, ["NBA"]);
  assert.equal(scope.leagueFilter, "");
  assert.deepEqual(
    scope.options.map((l) => l.key),
    ["NBA"],
  );
});
test("removing the current sport or league immediately falls back within the new selection", () => {
  const scope = sportsSelectionScope(catalog, ["NHL"], "basketball", false, "NBA");
  assert.equal(scope.group, "all");
  assert.deepEqual(scope.leagues, ["NHL"]);
});
test("explicit Explore browsing can open unselected competitions without mutating preferences", () => {
  const selected = ["NHL"];
  assert.deepEqual(sportsSelectionScope(catalog, selected, "soccer", true, "").leagues, [
    "EPL",
    "SERIEA",
  ]);
  assert.deepEqual(sportsSelectionScope(catalog, selected, "soccer", true, "SERIEA").leagues, [
    "SERIEA",
  ]);
  assert.deepEqual(selected, ["NHL"]);
  assert.deepEqual(sportsSelectionScope(catalog, selected, "all", false, "").leagues, ["NHL"]);
  assert.deepEqual(sportsSelectionScope(catalog, selected, "all", true, "").leagues, ["NHL"]);
});
test("aggregate feeds and cached extra events cannot leak into any personal rows", () => {
  const games = ["EPL", "SERIEA", "UFC", "NHL"].map(
    (league) => ({ id: league, league }) as SportsGame,
  );
  const selected = gamesInSportsSelection(games, catalog, ["EPL", "NHL"]);
  assert.deepEqual(
    selected.map((g) => g.league),
    ["EPL", "NHL"],
  );
  assert.equal(selected[0], games[0]);
  assert.deepEqual(gamesInSportsSelection(games, catalog, []), []);
});
