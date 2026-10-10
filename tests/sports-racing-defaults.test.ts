import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { racingDefaultPhoto } from "../src/lib/sports/racing-default-photo.ts";
import { MOTORSPORT_COVERAGE } from "../src/lib/sports/motorsport-catalog.ts";
test("every racing league has a bundled original fallback with distinct disciplines", () => {
  for (const league of [
    "F1",
    "INDY",
    "NASCAR",
    "NXS",
    "NCTS",
    ...MOTORSPORT_COVERAGE.map((r) => r[0]),
  ])
    assert.ok(existsSync(`public/sports/hero-photos/${racingDefaultPhoto(league)}.webp`), league);
  assert.notEqual(racingDefaultPhoto("MOTOGP"), racingDefaultPhoto("MXGP"));
  assert.notEqual(racingDefaultPhoto("F1"), racingDefaultPhoto("NASCAR"));
  assert.notEqual(racingDefaultPhoto("WRC"), racingDefaultPhoto("DAKAR"));
  assert.equal(existsSync("public/sports/track-photos"), false);
});
