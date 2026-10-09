import assert from "node:assert/strict";
import test from "node:test";
import { staticEventVenuePhoto } from "../src/lib/sports/event-venue-photo.ts";
import type { SportsGame } from "../src/lib/sports/espn-types";
import { existsSync } from "node:fs";
test("unlicensed pro and tennis venue photos cannot enter the renderer", () => {
  for (const league of ["NFL", "MLB", "NBA", "NHL", "ATP", "WTA", "TENNIS", "TENNIS_WTA"]) {
    const game = {
      league,
      home: { id: "14", abbr: "MIA" },
      context: { venue: "Kaseya Center" },
    } as SportsGame;
    assert.equal(staticEventVenuePhoto(game), undefined);
  }
  assert.equal(existsSync("public/sports/stadium-photos"), false);
  for (const sport of ["football", "baseball", "basketball", "hockey", "tennis"])
    assert.ok(existsSync(`public/sports/hero-photos/${sport}.webp`));
});
