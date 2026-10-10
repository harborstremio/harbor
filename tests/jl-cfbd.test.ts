// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  cfbdSeason,
  createCfbdClient,
  parseRankings,
  parseTeams,
  rankOf,
} from "../src/lib/jl/sports/cfbd.ts";

const RANKINGS = [
  {
    season: 2026,
    seasonType: "regular",
    week: 5,
    polls: [{ poll: "AP Top 25", ranks: [{ rank: 1, teamId: 2483, school: "Oregon" }] }],
  },
  {
    season: 2026,
    seasonType: "regular",
    week: 6,
    polls: [
      { poll: "Coaches Poll", ranks: [{ rank: 1, teamId: 194, school: "Ohio State" }] },
      {
        poll: "AP Top 25",
        ranks: [
          { rank: 2, teamId: 2483, school: "Oregon", conference: "Big Ten", points: 1490 },
          { rank: 1, teamId: 194, school: "Ohio State", firstPlaceVotes: 50, points: 1550 },
          { rank: 3, school: "No id" },
        ],
      },
    ],
  },
];

test("season: January belongs to the previous season", () => {
  assert.equal(cfbdSeason(new Date(2027, 0, 9)), 2026);
  assert.equal(cfbdSeason(new Date(2026, 9, 10)), 2026);
});

test("rankings: the latest week, AP first, ranks in order, rows without ids dropped", () => {
  const r = parseRankings(RANKINGS);
  assert.equal(r?.week, 6);
  assert.deepEqual(
    r?.polls.map((p) => p.name),
    ["AP Top 25", "Coaches Poll"],
  );
  assert.deepEqual(
    r?.polls[0].ranks.map((x) => [x.rank, x.teamId]),
    [
      [1, "194"],
      [2, "2483"],
    ],
  );
  assert.equal(rankOf(r, "2483"), 2);
  assert.equal(rankOf(r, "130"), null);
  assert.equal(parseRankings([]), null);
});

test("teams: v1 and v2 field names, colours without '#'", () => {
  const teams = parseTeams([
    {
      id: 2483,
      school: "Oregon",
      color: "#154733",
      alternateColor: "#FEE123",
      classification: "FBS",
    },
    {
      id: 61,
      school: "Gallaudet",
      alt_color: "#003366",
      logos: ["https://a.example.com/61.png", "x"],
    },
    { school: "No id" },
  ]);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].color, "154733");
  assert.equal(teams[0].altColor, "fee123");
  assert.equal(teams[0].classification, "fbs");
  assert.deepEqual(teams[1].logos, ["https://a.example.com/61.png"]);
});

test("client: cached answers, one request for parallel callers, failures keep the last answer", async () => {
  let clock = 1_000_000;
  let calls = 0;
  let fail = false;
  const store = new Map<string, string>();
  const client = createCfbdClient({
    now: () => clock,
    storage: { get: (k) => store.get(k) ?? null, set: (k, v) => void store.set(k, v) },
    fetch: async (url, init) => {
      calls++;
      assert.match(url, /\/rankings\?year=2026$/);
      assert.equal(init.headers.Authorization, "Bearer test-key");
      return fail
        ? { status: 500, text: async () => "" }
        : { status: 200, text: async () => JSON.stringify(RANKINGS) };
    },
  });
  const [a, b] = await Promise.all([
    client.rankings("test-key", 2026),
    client.rankings("test-key", 2026),
  ]);
  assert.equal(calls, 1);
  assert.equal(a?.week, 6);
  assert.equal(b?.week, 6);
  assert.ok(![...store.keys()].some((k) => k.includes("test-key")), "the key is never stored");

  clock += 7 * 3600_000;
  fail = true;
  assert.equal((await client.rankings("test-key", 2026))?.week, 6);
  assert.equal(calls, 2);
  // Within 15 minutes of a failure nothing is asked again.
  await client.rankings("test-key", 2026);
  assert.equal(calls, 2);
});
