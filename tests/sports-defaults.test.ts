import assert from "node:assert/strict";
import test from "node:test";
import { HUB_DEFAULTS, HUB_GROUPS, HUB_LEAGUES } from "../src/lib/sports/hub-data.ts";
import { selectedSportsLeagues, sportsSelectionScope } from "../src/lib/sports/personalization.ts";

test("first-use sports selection is bounded, valid, and covers every offered sport", () => {
  assert.ok(HUB_DEFAULTS.length >= 40 && HUB_DEFAULTS.length <= 52);
  assert.equal(new Set(HUB_DEFAULTS).size, HUB_DEFAULTS.length);
  const selection = selectedSportsLeagues(HUB_LEAGUES, [], false, HUB_DEFAULTS);
  assert.deepEqual(
    selection,
    HUB_DEFAULTS,
    "no default may silently disappear because its registry key is invalid",
  );
  const groups = new Set(
    HUB_LEAGUES.filter((league) => selection.includes(league.key)).map((league) => league.group),
  );
  for (const group of HUB_GROUPS) {
    if (HUB_LEAGUES.some((league) => league.group === group.key))
      assert.ok(groups.has(group.key), group.key);
  }
  for (const key of [
    "F1",
    "NASCAR",
    "INDYCAR",
    "MOTOGP",
    "BRASILEIRAO",
    "ROSHN",
    "EGYPT",
    "UAE",
    "QATAR",
    "NBA",
    "WNBA",
    "TENNIS",
    "TENNIS_WTA",
  ]) {
    assert.ok(selection.includes(key), `major requested competition ${key}`);
  }
});

test("broad defaults never expand existing preferences or undo a deliberately empty selection", () => {
  const chosen = ["NASCAR", "IPL"];
  for (const personalized of [false, true]) {
    assert.deepEqual(
      selectedSportsLeagues(HUB_LEAGUES, chosen, personalized, HUB_DEFAULTS),
      chosen,
    );
  }
  assert.deepEqual(selectedSportsLeagues(HUB_LEAGUES, [], true, HUB_DEFAULTS), []);
  const selection = selectedSportsLeagues(HUB_LEAGUES, chosen, true, HUB_DEFAULTS);
  assert.deepEqual(sportsSelectionScope(HUB_LEAGUES, selection, "motorsport", false, "").leagues, [
    "NASCAR",
  ]);
  assert.deepEqual(chosen, ["NASCAR", "IPL"], "selection must not mutate stored preferences");
});
