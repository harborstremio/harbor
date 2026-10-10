import test from "node:test";
import assert from "node:assert/strict";
import {
  baseballDefense,
  baseballBattingOrder,
  parseBaseballSituation,
} from "../src/lib/sports/baseball.ts";
import type { MatchPlayer } from "../src/lib/sports/espn-types.ts";

function player(id: string, position: string, extra: Partial<MatchPlayer> = {}): MatchPlayer {
  return {
    id,
    name: id,
    position,
    jersey: "",
    starter: false,
    goals: 0,
    yellowCards: 0,
    redCards: 0,
    ...extra,
  };
}
test("baseball uses active replacements and current pitcher, never removed starters", () => {
  const roster = [
    player("old", "LF", { starter: true, active: false, batOrder: 1 }),
    player("new", "LF", { active: true, batOrder: 1 }),
    player("starter", "SP", { starter: true, active: false }),
    player("relief", "RP", { active: true }),
  ];
  const defense = baseballDefense(roster, "in", "relief");
  assert.equal(defense.find((p) => p.key === "LF")?.player?.id, "new");
  assert.equal(defense.find((p) => p.key === "P")?.player?.id, "relief");
  assert.equal(defense.find((p) => p.key === "CF")?.player, undefined);
  assert.deepEqual(
    baseballBattingOrder(roster, "in").map((p) => p.id),
    ["new"],
  );
  assert.equal(baseballDefense(roster, "pre").find((p) => p.key === "LF")?.player?.id, "old");
});
test("missing counts stay unknown and runners/pitcher retain provider identities", () => {
  assert.equal(parseBaseballSituation(null), undefined);
  const situation = parseBaseballSituation({
    balls: 0,
    strikes: 2,
    outs: 1,
    pitcher: { playerId: 123 },
    onFirst: { playerId: "456" },
  });
  assert.equal(situation?.balls, 0);
  assert.equal(situation?.pitcherId, "123");
  assert.equal(situation?.onFirstId, "456");
  assert.equal(situation?.onSecondId, undefined);
  assert.equal(parseBaseballSituation({ balls: "0", outs: 12 })?.balls, undefined);
  assert.equal(parseBaseballSituation({ outs: 12 })?.outs, undefined);
});
