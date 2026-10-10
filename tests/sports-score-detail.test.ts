import assert from "node:assert/strict";
import test from "node:test";
import { toSide } from "../src/lib/sports/espn-parse.ts";
import { publishedScoreDetail, scoreMetric } from "../src/lib/sports/score-detail.ts";
test("tennis preserves games per set, service, zero and tie-breaks without counting a live lead as a won set", () => {
  const side = toSide(
    {
      type: "athlete",
      id: "3568",
      athlete: { displayName: "Miriam Bulgaru" },
      possession: true,
      linescores: [{ value: 6, winner: true }, { value: 1, winner: false }, { value: 4 }],
    },
    "tennis",
  );
  assert.equal(side.score, "1");
  assert.equal(side.serving, true);
  assert.deepEqual(
    side.periods?.map((r) => r.value),
    ["6", "1", "4"],
  );
  assert.equal(side.periods?.[2].winner, undefined);
  assert.equal(side.currentPoint, undefined);
  const tie = publishedScoreDetail(
    {
      currentScore: "AD",
      linescores: [{ displayValue: "7", value: 7, tiebreak: 5 }, { value: 0 }],
    },
    "tennis",
  );
  assert.equal(tie.currentPoint, "AD");
  assert.equal(tie.periods?.[0].tiebreak, "5");
  assert.equal(tie.periods?.[1].value, "0");
});
test("team period scores remain separate from total and unknown scores are not fabricated", () => {
  const side = toSide(
    {
      score: { displayValue: "102" },
      linescores: [
        { period: 1, value: 22 },
        { period: 2, value: 30 },
      ],
    },
    "basketball",
  );
  assert.equal(side.score, "102");
  assert.equal(side.periods?.length, 2);
  assert.equal(toSide(undefined).score, "");
  assert.equal(scoreMetric("volleyball"), "Sets won");
  assert.equal(scoreMetric("snooker"), "Frames");
  assert.equal(scoreMetric("baseball"), "Runs");
  assert.equal(scoreMetric("football"), "Points");
});
import { hasUsefulScoreBreakdown } from "../src/lib/sports/score-detail.ts";
import type { SportsGame } from "../src/lib/sports/espn-types";
test("no redundant soccer table or repeated single-period totals", () => {
  const game = {
    state: "in",
    home: { score: "3", periods: [{ period: 1, value: "3" }] },
    away: { score: "0", periods: [{ period: 1, value: "0" }] },
  } as SportsGame;
  assert.equal(hasUsefulScoreBreakdown(game, "soccer"), false);
  assert.equal(hasUsefulScoreBreakdown(game, "basketball"), false);
  assert.equal(
    hasUsefulScoreBreakdown(
      { ...game, home: { ...game.home, score: "1", periods: [{ period: 1, value: "6" }] } },
      "tennis",
    ),
    true,
  );
});
