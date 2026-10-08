import assert from "node:assert/strict";
import test from "node:test";
import { diffRows, playerToRow, rowsToFavorites, teamToRow } from "../src/lib/jl/account/mapping.ts";

const PROFILE = "00000000-0000-0000-0000-000000000001";

test("favorites become rows the table accepts", () => {
  assert.deepEqual(teamToRow(PROFILE, { league: "NCAAF", id: "417", name: "Gallaudet Bison" }), {
    profile_id: PROFILE,
    kind: "team",
    item_id: "NCAAF:417",
    meta: { name: "Gallaudet Bison" },
  });
  assert.equal(teamToRow(PROFILE, { league: "NFL", id: "a:b", name: "Bad id" }), null);
  assert.equal(
    playerToRow(PROFILE, {
      league: "NFL",
      id: "3139477",
      name: "Patrick Mahomes",
      teamId: "12",
      teamName: "Kansas City Chiefs",
      headshot: null,
      position: "QB",
    })?.item_id,
    "NFL:3139477",
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
      { kind: "team", item_id: "NCAAF:417", meta: { name: "Gallaudet Bison" } },
      { kind: "player", item_id: "NFL:1", meta: { name: "Known Player" } },
      { kind: "player", item_id: "NFL:2", meta: { name: "New Player" } },
      { kind: "team", item_id: "broken", meta: { name: "Skipped" } },
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
  const remote = [{ kind: "team" as const, item_id: "NFL:12" }];
  const d = diffRows(local, remote);
  assert.deepEqual(
    d.upsert.map((r) => r.item_id),
    ["NCAAF:417"],
  );
  assert.deepEqual(d.remove, remote);
});
