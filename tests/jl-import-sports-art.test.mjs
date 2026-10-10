import assert from "node:assert/strict";
import test from "node:test";
import { parseFolderName, parseTeamHits, pickTeam } from "../scripts/import-sports-art.mjs";

const search = {
  results: [
    {
      type: "team",
      contents: [
        { uid: "s:20~l:23~t:2483", displayName: "Oregon Ducks" },
        { uid: "s:20~l:23~t:204", displayName: "Oregon State Beavers" },
        { uid: "s:40~l:41~t:2483", displayName: "Oregon Ducks" },
        { uid: "s:600~l:700~t:1", displayName: "Oregon FC" },
      ],
    },
    { type: "player", contents: [{ uid: "s:20~l:23~a:9", displayName: "Oregon Player" }] },
  ],
};

test("import: folder names carry an optional league hint", () => {
  assert.deepEqual(parseFolderName("Oregon Ducks [NCAAF]"), {
    name: "Oregon Ducks",
    league: "NCAAF",
  });
  assert.deepEqual(parseFolderName("Golden State Warriors"), {
    name: "Golden State Warriors",
    league: null,
  });
});

test("import: ESPN search hits map to league tags; unknown leagues are dropped", () => {
  assert.deepEqual(parseTeamHits(search), [
    { league: "NCAAF", id: "2483", name: "Oregon Ducks" },
    { league: "NCAAF", id: "204", name: "Oregon State Beavers" },
    { league: "NCAA", id: "2483", name: "Oregon Ducks" },
  ]);
  assert.deepEqual(parseTeamHits(null), []);
});

test("import: the exact name in the hinted league wins", () => {
  const hits = parseTeamHits(search);
  assert.equal(pickTeam(hits, "Oregon Ducks", "NCAAF")?.league, "NCAAF");
  assert.equal(pickTeam(hits, "Oregon Ducks", "NCAAB")?.league, "NCAA");
  assert.equal(pickTeam(hits, "oregon state beavers", null)?.id, "204");
  assert.equal(pickTeam(hits, "Oregon Ducks", "NHL"), null);
});
