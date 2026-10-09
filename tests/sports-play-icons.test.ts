import test from "node:test";
import assert from "node:assert/strict";
import { playIcon } from "../src/lib/sports/play-icon.ts";
test("play glyphs distinguish turnovers, scores, incomplete passes and ordinary plays", () => {
  const cases = [
    ["Pass deep INTERCEPTED", "interception"],
    ["Pass incomplete deep left", "incomplete"],
    ["Pass for 6 yards TOUCHDOWN", "touchdown"],
    ["Timeout #1", "timeout"],
    ["Pass complete to receiver", "pass"],
    ["Sacked for -6 yards", "sack"],
    ["Run left tackle FUMBLE", "fumble"],
    ["45 yard field goal GOOD", "kick"],
    ["Home run to left", "homerun"],
    ["Struck out swinging", "strikeout"],
    ["Three-point jump shot", "three"],
  ];
  for (const [text, icon] of cases) assert.equal(playIcon({ type: "other", text }), icon, text);
  assert.equal(playIcon({ type: "yellow_card", text: "Foul" }), "yellow_card");
});
