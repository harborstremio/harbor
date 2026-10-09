import test from "node:test";
import assert from "node:assert/strict";
import { venueLineup } from "../src/lib/sports/venue-lineups.ts";
import { footballPositions, parseFootballSquad } from "../src/lib/sports/field-lineups.ts";
const player = (id: string, position: string, starter = true, jersey = "") => ({
  id,
  name: id,
  position,
  starter,
  jersey,
  goals: 0,
  yellowCards: 0,
  redCards: 0,
});
test("hockey anchors require reported starters and correct positions without duplicate athletes", () => {
  const lineup = venueLineup("hockey", [
    player("bench", "C", false),
    player("center", "C"),
    player("goalie", "G"),
    player("defense", "D"),
    player("left", "LW"),
  ]);
  assert.equal(lineup.find((x) => x.label === "C")?.player?.id, "center");
  assert.equal(lineup.filter((x) => x.player?.id === "defense").length, 1);
  assert.equal(lineup.find((x) => x.label === "RD")?.player, undefined);
  assert.equal(
    lineup.some((x) => x.player?.id === "bench"),
    false,
  );
});
test("rugby uses announced shirt numbers, while unreported cricket/AFL positions are never invented", () => {
  const lineup = venueLineup("rugby", [
    player("prop", "PR", true, "1"),
    player("reserve", "PR", false, "2"),
  ]);
  assert.equal(lineup[0].player?.id, "prop");
  assert.equal(lineup[1].player, undefined);
  assert.equal(venueLineup("cricket", [player("batter", "BAT")]).length, 0);
  assert.equal(venueLineup("aussie", [player("forward", "F")]).length, 0);
});
test("college squad remains separate from unconfirmed football formation slots", () => {
  const squad = parseFootballSquad({
    athletes: [
      {
        items: [
          {
            id: "1",
            displayName: "Player",
            position: { abbreviation: "QB" },
            headshot: { href: "https://example.com/player.png" },
          },
        ],
      },
    ],
  });
  assert.equal(squad[0].starter, false);
  assert.equal(squad[0].position, "QB");
  for (const unit of ["offense", "defense"] as const) {
    const slots = footballPositions(unit);
    assert.equal(slots.length, 11);
    assert.equal(
      slots.some((x) => x.player),
      false,
    );
    assert.ok(slots.every((x) => x.x > 0 && x.x < 100 && x.y > 0 && x.y < 100));
  }
});
