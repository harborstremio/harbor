import assert from "node:assert/strict";
import test from "node:test";
import {
  asSportFor,
  mergeSeason,
  pickTeam,
  schoolKey,
  teamSearchPath,
  toSchoolEvent,
} from "../src/lib/jl/sports/student-fallback.ts";

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new Error("expected a value");
  return v;
}

test("maps SIDEARM sport slugs to AllSports sports and genders", () => {
  assert.deepEqual(asSportFor("football"), { base: "/api/american-football", gender: "M" });
  assert.deepEqual(asSportFor("womens-basketball"), { base: "/api/basketball", gender: "F" });
  assert.deepEqual(asSportFor("softball"), { base: "/api/baseball", gender: "F" });
  assert.deepEqual(asSportFor("mens-soccer"), { base: "/api", gender: "M" });
  assert.equal(asSportFor("rowing"), null);
});

test("finds the school's team by name and gender", () => {
  assert.equal(schoolKey("The University of Gallaudet"), "gallaudet");
  assert.equal(schoolKey("Gallaudet University"), "gallaudet");
  assert.equal(
    teamSearchPath("/api/basketball", "north dakota"),
    "/api/basketball/search/north-dakota",
  );
  const search = {
    results: [
      { type: "player", entity: { id: 9, name: "Gallaudet Smith" } },
      { type: "team", entity: { id: 1, name: "Gallaudet Bison", gender: "F" } },
      { type: "team", entity: { id: 2, name: "Gallaudet Bison", gender: "M" } },
    ],
  };
  assert.deepEqual(pickTeam(search, "gallaudet", "M"), { id: 2, name: "Gallaudet Bison" });
  assert.deepEqual(pickTeam(search, "gallaudet", null), { id: 1, name: "Gallaudet Bison" });
  assert.equal(pickTeam(search, "howard", null), null);
  assert.equal(pickTeam(null, "gallaudet", null), null);
});

const game = (
  id: number,
  home: number,
  away: number,
  start: number,
  finished: boolean,
  hs?: number,
  as?: number,
) => ({
  id,
  homeTeam: { id: home, name: home === 2 ? "Gallaudet Bison" : "Rival" },
  awayTeam: { id: away, name: away === 2 ? "Gallaudet Bison" : "Rival" },
  homeScore: hs === undefined ? {} : { current: hs },
  awayScore: as === undefined ? {} : { current: as },
  status: { type: finished ? "finished" : "notstarted" },
  startTimestamp: start,
});

test("turns games into the team's season", () => {
  const away = must(toSchoolEvent(game(7, 5, 2, 1_790_000_000, true, 10, 21), 2));
  assert.equal(away.home, false);
  assert.equal(away.opponent, "Rival");
  assert.equal(away.result, "W");
  assert.equal(away.score, "21-10");
  assert.equal(away.stream, null);
  assert.equal(toSchoolEvent(game(8, 2, 5, 1_791_000_000, false), 2)?.result, null);
  assert.equal(toSchoolEvent({ id: 1 }, 2), null);

  const season = mergeSeason(
    [
      { events: [game(8, 2, 5, 1_791_000_000, false), game(7, 5, 2, 1_790_000_000, true, 10, 21)] },
      { events: [game(8, 2, 5, 1_791_000_000, false)] },
      null,
    ],
    2,
  );
  assert.deepEqual(
    season.map((e) => e.id),
    ["as:7", "as:8"],
  );
});
