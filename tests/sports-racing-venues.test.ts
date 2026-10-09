import assert from "node:assert/strict";
import test from "node:test";
import { racingVenue, RACING_VENUES } from "../src/lib/sports/racing-venues.ts";

test("INDYCAR uses the event's actual IMS road course or Indianapolis500 oval", () => {
  const road = racingVenue({
    league: "INDY",
    name: "Grand Prix of Indianapolis (Road Course)",
    venue: "Indianapolis Motor Speedway",
  });
  const oval = racingVenue({
    league: "INDY",
    name: "Indianapolis 500",
    venue: "Indianapolis Motor Speedway",
  });
  assert.equal(road?.layout, "road");
  assert.equal(road?.length, "2.439 mi");
  assert.equal(oval?.layout, "oval");
  assert.equal(oval?.length, "2.5 mi");
  assert.notEqual(road?.map, oval?.map);
  assert.equal(
    racingVenue({
      league: "NASCAR",
      name: "Indianapolis Motor Speedway Road Course",
    }),
    null,
  );
});

test("Gateway naming maps to each championship's official track image", () => {
  const indy = racingVenue({ league: "INDY", name: "Grand Prix of Illinois" });
  const nascar = racingVenue({
    league: "NASCAR",
    name: "Enjoy Illinois300",
    venue: "World Wide Technology Raceway at Gateway",
  });
  assert.equal(indy?.name, "World Wide Technology Raceway");
  assert.equal(nascar?.name, "World Wide Technology Raceway");
  assert.match(indy?.map ?? "", /Gateway_TrackMap/);
  assert.match(nascar?.map ?? "", /45\.png/);
  assert.ok(nascar?.logo);
  assert.equal(nascar?.photo, undefined);
});

test("new2026 Indy street maps and changed Nashville layout keep historical boundaries", () => {
  assert.match(
    racingVenue({ league: "INDY", name: "Grand Prix of Ontario" })?.map ?? "",
    /Markham/,
  );
  assert.match(
    racingVenue({ league: "INDY", name: "Grand Prix of Washington, D.C." })?.map ?? "",
    /WashingtonDC/,
  );
  assert.equal(racingVenue({ league: "INDY", name: "Grand Prix of Nashville" })?.layout, "oval");
  assert.equal(
    racingVenue({
      league: "INDY",
      name: "Grand Prix of Nashville",
      startMs: Date.parse("2023-08-06T12:00:00Z"),
    }),
    null,
  );
  assert.equal(racingVenue({ league: "INDY", name: "Detroit Belle Isle Grand Prix" }), null);
  assert.equal(racingVenue({ league: "INDY", name: "Grand Prix of Toronto" }), null);
});

test("NASCAR venue disambiguation preserves Roval and does not match city substrings", () => {
  assert.equal(
    racingVenue({
      league: "NASCAR",
      venue: "Charlotte Motor Speedway",
      name: "Bank of America Roval400",
    })?.layout,
    "road",
  );
  assert.equal(
    racingVenue({
      league: "NASCAR",
      venue: "Charlotte Motor Speedway",
      name: "Coca-Cola600",
    })?.layout,
    "oval",
  );
  assert.equal(
    racingVenue({
      league: "NASCAR",
      name: "Texas Grand Prix at COTA",
      venue: "Circuit of The Americas",
    })?.id,
    "nascar-214",
  );
  assert.equal(racingVenue({ league: "NASCAR", name: "Kansas City championship" }), null);
  assert.equal(racingVenue({ league: "F1", name: "Circuit of The Americas" }), null);
  assert.equal(
    racingVenue({
      league: "NASCAR",
      venue: "Bristol Motor Speedway",
      name: "Bristol Dirt Race",
    }),
    null,
  );
});

test("known provider placeholder outlines are discarded instead of posing as different tracks", () => {
  assert.equal(racingVenue({ league: "NASCAR", name: "Auto Club Speedway" }), null);
  assert.equal(
    racingVenue({ league: "NASCAR", name: "North Wilkesboro Speedway" })?.map,
    undefined,
  );
  assert.equal(
    racingVenue({ league: "NASCAR", name: "North Wilkesboro Speedway" })?.photo,
    undefined,
  );
  const copied = RACING_VENUES.filter((row) => row.map?.endsWith("/111.png"));
  assert.deepEqual(
    copied.map((row) => row.id),
    ["nascar-111"],
  );
  for (const row of RACING_VENUES) {
    for (const image of [row.map, row.photo, row.logo, row.outline].filter(Boolean)) {
      const url = new URL(image!);
      assert.equal(url.protocol, "https:");
      assert.ok(["www.nascar.com", "www.indycar.com"].includes(url.hostname));
    }
  }
});

test("NASCAR support series use exact provider track identity when available", () => {
  assert.equal(racingVenue({ league: "NXS", trackId: 45 })?.id, "nascar-45");
  assert.equal(racingVenue({ league: "NXS", name: "Unknown title", trackId: 45 })?.id, "nascar-45");
  assert.equal(racingVenue({ league: "NCTS", name: "Race at Gateway" })?.id, "nascar-45");
});
