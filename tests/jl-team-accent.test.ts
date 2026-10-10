// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { teamAccent } from "../src/lib/jl/sports/team-look.ts";

test("team accents use the team's own colour, never a stand-in", () => {
  // Alabama: crimson shows on dark, with white text on it.
  assert.deepEqual(teamAccent({ primary: "9e1b32", secondary: "828a8f" }), {
    color: "9e1b32",
    ink: "ffffff",
  });
  // Oregon: dark green steps aside for the yellow, with dark text on it.
  assert.deepEqual(teamAccent({ primary: "154733", secondary: "fee123" }), {
    color: "fee123",
    ink: "111111",
  });
  // Seahawks: navy → action green.
  assert.equal(teamAccent({ primary: "002244", secondary: "69be28" }).color, "69be28");
  // Penn State: navy and white → a lighter navy, not someone else's colour.
  const psu = teamAccent({ primary: "041e42", secondary: "ffffff" }).color;
  assert.notEqual(psu, "041e42");
  assert.ok(parseInt(psu.slice(4, 6), 16) > parseInt(psu.slice(0, 2), 16), "still blue");
});
