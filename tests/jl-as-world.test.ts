import assert from "node:assert/strict";
import test from "node:test";
import type { AsGet } from "../src/lib/jl/sports/as-core.ts";
import {
  leaguesPath,
  loadLeague,
  parseCategories,
  parseLeagues,
  parseSeasons,
} from "../src/lib/jl/sports/as-world.ts";

test("categories: regions first, then countries A–Z, no duplicates", () => {
  const c = parseCategories({
    categories: [
      { id: 3, name: "Spain", alpha2: "ES" },
      { id: 1, name: "England", alpha2: "EN" },
      { id: 9, name: "World" },
      { id: 1, name: "England" },
      { id: 0, name: "Broken" },
    ],
  });
  assert.deepEqual(
    c.map((x) => x.name),
    ["World", "England", "Spain"],
  );
  assert.equal(c[1].alpha2, "EN");
});

test("leagues: grouped or flat answers", () => {
  const grouped = parseLeagues({
    groups: [
      {
        uniqueTournaments: [
          { id: 17, name: "Premier League", primaryColorHex: "#3c1c5a" },
          { id: 18, name: "Championship" },
        ],
      },
    ],
  });
  assert.deepEqual(
    grouped.map((l) => l.id),
    [17, 18],
  );
  assert.equal(grouped[0].color, "3c1c5a");
  assert.equal(
    parseLeagues({
      uniqueTournaments: [
        { id: 30, name: "EHF" },
        { id: 30, name: "EHF" },
      ],
    }).length,
    1,
  );
  assert.equal(leaguesPath("handball", 5), "/api/handball/unique-tournament/all/category/5");
  assert.equal(leaguesPath("football", 1), "/api/tournament/all/category/1");
  assert.deepEqual(
    parseSeasons({
      seasons: [
        { id: 2, name: "25/26" },
        { id: 1, year: "24/25" },
      ],
    }),
    [
      { id: 2, name: "25/26" },
      { id: 1, name: "24/25" },
    ],
  );
});

test("league: last season's table when this one hasn't started; fixtures in order", async () => {
  const ev = (id: number, t: number, type: string) => ({
    id,
    startTimestamp: t,
    status: { type },
    homeTeam: { id: 1, name: "A" },
    awayTeam: { id: 2, name: "B" },
  });
  const answers: Record<string, unknown> = {
    "/api/tournament/17": {
      uniqueTournament: { name: "Premier League", primaryColorHex: "#3c1c5a" },
    },
    "/api/tournament/17/seasons": {
      seasons: [
        { id: 2, name: "26/27" },
        { id: 1, name: "25/26" },
      ],
    },
    "/api/tournament/17/season/1/standings/total": {
      standings: [{ name: "PL", rows: [{ team: { id: 1, name: "A" }, position: 1 }] }],
    },
    "/api/tournament/17/season/2/matches/next/0": {
      events: [ev(11, 300, "notstarted"), ev(10, 200, "notstarted")],
    },
    "/api/tournament/17/season/2/matches/last/0": {
      events: [ev(8, 100, "finished"), ev(9, 150, "finished")],
    },
  };
  const l = await loadLeague((async (p: string) => answers[p] ?? null) as AsGet, "football", 17);
  assert.equal(l.name, "Premier League");
  assert.equal(l.season?.id, 2);
  assert.equal(l.tableSeason?.id, 1);
  assert.deepEqual(
    l.next.map((g) => g.id),
    [10, 11],
  );
  assert.deepEqual(
    l.last.map((g) => g.id),
    [9, 8],
  );
});
