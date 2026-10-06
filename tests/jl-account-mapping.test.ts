import assert from "node:assert/strict";
import test from "node:test";
import {
  diffRows,
  harborLeagueTag,
  jlLeagueKey,
  playerToRow,
  rowsToFavorites,
  teamToRow,
} from "../src/lib/jl/account/mapping.ts";

const PROFILE = "00000000-0000-0000-0000-000000000001";

test("league tags and JL keys map both ways; unsupported leagues are skipped", () => {
  assert.equal(jlLeagueKey("NCAAF"), "cfb");
  assert.equal(jlLeagueKey("NCAA"), "cbb");
  assert.equal(harborLeagueTag("cfb"), "NCAAF");
  assert.equal(harborLeagueTag("wnba"), null);
  assert.equal(teamToRow(PROFILE, { league: "F1", id: "1", name: "X" }), null);
});

test("favorites become rows the table accepts", () => {
  assert.deepEqual(teamToRow(PROFILE, { league: "NCAAF", id: "417", name: "Gallaudet Bison" }), {
    profile_id: PROFILE,
    kind: "team",
    league: "cfb",
    espn_id: "417",
    name: "Gallaudet Bison",
  });
  assert.equal(teamToRow(PROFILE, { league: "NFL", id: "abc", name: "Bad id" }), null);
  assert.equal(
    playerToRow(PROFILE, {
      league: "NFL",
      id: "3139477",
      name: "Patrick Mahomes",
      teamId: "12",
      teamName: "Kansas City Chiefs",
      headshot: null,
      position: "QB",
    })?.kind,
    "athlete",
  );
});

test("remote rows become favorites; unknown players are flagged for a team lookup", () => {
  const known = {
    league: "NFL",
    id: "1",
    name: "Known Player",
    teamId: "12",
    teamName: "Kansas City Chiefs",
    headshot: null,
    position: "WR",
  };
  const out = rowsToFavorites(
    [
      { kind: "team", league: "cfb", espn_id: "417", name: "Gallaudet Bison" },
      { kind: "athlete", league: "nfl", espn_id: "1", name: "Known Player" },
      { kind: "athlete", league: "nfl", espn_id: "2", name: "New Player" },
      { kind: "team", league: "f1", espn_id: "9", name: "Skipped" },
    ],
    [known],
  );
  assert.deepEqual(out.teams, [{ league: "NCAAF", id: "417", name: "Gallaudet Bison" }]);
  assert.deepEqual(
    out.players.map((p) => p.id),
    ["1", "2"],
  );
  assert.equal(out.players[0], known);
  assert.deepEqual(
    out.unresolved.map((p) => p.id),
    ["2"],
  );
});

test("diff adds what's only local and removes what's only remote", () => {
  const local = [teamToRow(PROFILE, { league: "NCAAF", id: "417", name: "Gallaudet Bison" })!];
  const remote = [{ kind: "team" as const, league: "nfl", espn_id: "12" }];
  const d = diffRows(local, remote);
  assert.deepEqual(
    d.upsert.map((r) => r.espn_id),
    ["417"],
  );
  assert.deepEqual(d.remove, remote);
});
