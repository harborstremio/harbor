import assert from "node:assert/strict";
import test from "node:test";
import { parseEventChannel, teamKey, type ParsedEvent } from "../src/lib/jl/sports/event-parse.ts";

// Saturday 11:30 PT.
const now = new Date("2026-09-26T18:30:00Z");

function plain(e: ParsedEvent | null) {
  assert.ok(e);
  return {
    sport: e.sport,
    teams: e.teams.map((t) => ({ ...t })),
    atHome: e.atHome,
    start: e.start.toISOString(),
    network: e.network,
    alternate: e.alternate,
  };
}

test("NCAAF channel with AP ranks; 12:00 PM ET in September is 16:00 UTC", () => {
  assert.deepEqual(plain(parseEventChannel("NCAAF 03: #1 Texas vs. #14 Tennessee @ 26 Sep 12:00 PM ET", "USA NCAAF", now)), {
    sport: "cfb",
    teams: [
      { name: "Texas", rank: 1 },
      { name: "Tennessee", rank: 14 },
    ],
    atHome: false,
    start: "2026-09-26T16:00:00.000Z",
    network: null,
    alternate: false,
  });
});

test('show label and network in brackets; "at" makes the second team home', () => {
  const e = plain(
    parseEventChannel(
      "NCAAF 10: FOX College Football - Big Ten: Illinois at Ohio St. (FOX Sports) @ 26 Sep 12:00 PM ET",
      "USA NCAAF",
      now,
    ),
  );
  assert.deepEqual(e.teams, [
    { name: "Illinois", rank: null },
    { name: "Ohio St.", rank: null },
  ]);
  assert.equal(e.atHome, true);
  assert.equal(e.network, "FOX Sports");
});

test('"No. 11" ranks, conference labels and "Football -" prefixes', () => {
  assert.deepEqual(
    plain(parseEventChannel("NCAAF 11: Big 12 Football: Sam Houston at No. 11 Texas Tech @ 26 Sep 12:00 PM ET", "USA NCAAF", now))
      .teams,
    [
      { name: "Sam Houston", rank: null },
      { name: "Texas Tech", rank: 11 },
    ],
  );
  const b1g = plain(
    parseEventChannel("NCAAF 27: B1G Football - UCLA at Maryland (Big Ten Network) @ 26 Sep 01:30 PM ET", "USA NCAAF", now),
  );
  assert.deepEqual([b1g.teams[0].name, b1g.teams[1].name, b1g.network], ["UCLA", "Maryland", "Big Ten Network"]);
  assert.equal(
    plain(parseEventChannel("NCAAF 100: Football - Oregon St at UTEP @ 26 Sep 09:00 PM ET", "USA NCAAF", now)).start,
    "2026-09-27T01:00:00.000Z",
  );
});

test("ESPN+ event channels: football only, Spanish feed marked alternate", () => {
  const category = "ESPN Events 200 VIP channels";
  const e = plain(parseEventChannel("USA ESPN+ 018: NCAA Football: #1 Texas vs. #14 Tennessee (2026-09-26 12:00:00)", category, now));
  assert.equal(e.sport, "cfb");
  assert.equal(e.start, "2026-09-26T16:00:00.000Z");
  assert.equal(e.alternate, false);
  assert.equal(
    parseEventChannel("USA ESPN+ 019: NCAA Football: #1 Texas vs. #14 Tennessee (ESP) (2026-09-26 12:00:05)", category, now)
      ?.alternate,
    true,
  );
  assert.equal(parseEventChannel("USA ESPN+ 017: Soccer: Western KY vs. Liberty (2026-09-26 11:30:00)", category, now), null);
  assert.equal(
    parseEventChannel("USA ESPN+ 016: Patriot League: Boston U vs. Bucknell (2026-09-26 11:00:10)", category, now),
    null,
  );
});

test("BIG10+ names; other sports and press conferences are skipped", () => {
  const e = plain(parseEventChannel("BIG10+ 07: Football UCLA at Maryland Sat @ Sep 26 04:30PM ET", "USA BIG10+", now));
  assert.deepEqual([e.teams[0].name, e.teams[1].name, e.start], ["UCLA", "Maryland", "2026-09-26T20:30:00.000Z"]);
  assert.equal(parseEventChannel("BIG10+ 02: Soccer (M) Penn State at Indiana Fri @ Sep 25 01:00PM ET", "USA BIG10+", now), null);
  assert.equal(
    parseEventChannel(
      "BIG10+ 18: Football Howard at Rutgers Postgame Press Conference Fri @ Sep 25 10:00PM ET",
      "USA BIG10+",
      now,
    ),
    null,
  );
});

test("names without a game or time are not events", () => {
  assert.equal(parseEventChannel("USA NFL Network", "USA NFL - Sunday Ticket", now), null);
  assert.equal(parseEventChannel("NCAAF Back-up 01", "NCAAF Back-up", now), null);
});

test("NFL game channels in an NFL category", () => {
  const e = plain(
    parseEventChannel("NFL 04: Seattle Seahawks at San Francisco 49ers @ 27 Sep 04:25 PM ET", "USA NFL - Sunday Ticket", now),
  );
  assert.equal(e.sport, "nfl");
  assert.equal(e.teams[1].name, "San Francisco 49ers");
  assert.equal(e.start, "2026-09-27T20:25:00.000Z");
});

test("team keys match across sources", () => {
  assert.equal(teamKey("Ohio St."), teamKey("Ohio State"));
  assert.equal(teamKey("Hawai'i"), "hawaii");
  assert.equal(teamKey("St. Lawrence"), "saint lawrence");
  assert.equal(teamKey("Texas A&M"), "texas a and m");
});
