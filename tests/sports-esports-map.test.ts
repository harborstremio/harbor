import test from "node:test";
import assert from "node:assert/strict";
import {
  esportsGameKind,
  parseDotaRoster,
  reportedLaneAnchor,
  ESPORTS_MAPS,
} from "../src/lib/sports/esports-map-data.ts";

const heroes = {
  1: {
    localized_name: "Anti-Mage",
    img: "/apps/dota2/images/dota_react/heroes/antimage.png",
  },
};
test("Dota live picks never turn lane guesses or stale data into live positions", () => {
  const now = 1_800_000_000_000;
  const raw = {
    last_update_time: now / 1000,
    players: [
      {
        team: 0,
        team_slot: 1,
        hero_id: 1,
        name: "Player",
        lane_role: 1,
        kills: 0,
        deaths: 2,
        assists: 3,
      },
      { team: 0, team_slot: 1, hero_id: 1, name: "Duplicate" },
      { team: 9, team_slot: 1, hero_id: 1 },
    ],
  };
  const roster = parseDotaRoster(raw, heroes, true, now);
  assert.equal(roster.players.length, 1);
  assert.equal(roster.players[0].kills, 0);
  assert.equal(roster.players[0].lane, undefined);
  assert.equal(reportedLaneAnchor(roster.players[0]), undefined);
  assert.equal(
    roster.players[0].image,
    "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
  );
  assert.equal(
    parseDotaRoster({ ...raw, last_update_time: now / 1000 - 301 }, heroes, true, now).players
      .length,
    0,
  );
});
test("parsed Dota lanes retain team ownership while unknown roles stay unpositioned", () => {
  const roster = parseDotaRoster(
    {
      players: [
        { player_slot: 0, hero_id: 1, lane_role: 1 },
        { player_slot: 128, hero_id: 1, lane_role: 1 },
        { player_slot: 129, hero_id: 1, lane_role: 0 },
      ],
    },
    heroes,
    false,
  );
  assert.deepEqual(reportedLaneAnchor(roster.players[0]), { x: 74, y: 80 });
  assert.deepEqual(reportedLaneAnchor(roster.players[1]), { x: 26, y: 20 });
  assert.equal(reportedLaneAnchor(roster.players[2]), undefined);
  assert.equal(roster.players[2].kills, undefined);
});
test("map identification never substitutes an unrelated esport or map", () => {
  assert.equal(esportsGameKind({ league: "LCK" }), "lol");
  assert.equal(esportsGameKind({ league: "VCT" }), "valorant");
  assert.equal(esportsGameKind({ league: "CS2" }), "cs2");
  assert.equal(esportsGameKind({ league: "DOTA2" }), "dota");
  assert.equal(esportsGameKind({ league: "RLCS" }), "rocketleague");
  assert.ok(ESPORTS_MAPS.valorant.length >= 12);
  assert.ok(
    ESPORTS_MAPS.valorant.every(
      (map) =>
        map.image?.startsWith("https://cmsassets.rgpub.io/") &&
        map.source.startsWith("https://playvalorant.com/"),
    ),
  );
  assert.ok(ESPORTS_MAPS.cs2.length >= 38);
  assert.ok(
    ESPORTS_MAPS.cs2.every((map) => map.image?.includes("/images/radars/") && !map.referenceOnly),
  );
  const nuke = ESPORTS_MAPS.cs2.find((map) => map.id === "de_nuke");
  assert.equal(nuke?.layers?.length, 2);
  assert.ok(
    nuke?.layers?.some((layer) => layer.name === "Lower level" && layer.image.includes("_lower_")),
  );
  assert.ok(
    nuke?.layers?.every((layer) => layer.fallbackImage?.startsWith("https://cdn.jsdelivr.net/")),
  );
});
