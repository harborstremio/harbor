import assert from "node:assert/strict";
import test from "node:test";
import { parseAthleteForFollow, parseSearchResults } from "../src/lib/jl/sports/search-parse.ts";

test("search keeps teams and players in covered leagues, mapped to Harbor league tags", () => {
  const hits = parseSearchResults({
    results: [
      {
        type: "team",
        contents: [
          { uid: "s:20~l:23~t:417", displayName: "Gallaudet Bison", subtitle: "NCAAF", image: { default: "http://a/417.png" } },
          { uid: "s:600~l:700~t:1", displayName: "Some Soccer Club" },
        ],
      },
      {
        type: "player",
        contents: [{ uid: "s:20~l:28~a:3139477", displayName: "Patrick Mahomes", subtitle: "Kansas City Chiefs" }],
      },
      { type: "article", contents: [{ uid: "x", displayName: "News" }] },
    ],
  });
  assert.deepEqual(hits, [
    { kind: "team", league: "NCAAF", id: "417", name: "Gallaudet Bison", subtitle: "NCAAF", image: "https://a/417.png" },
    {
      kind: "player",
      league: "NFL",
      id: "3139477",
      name: "Patrick Mahomes",
      subtitle: "Kansas City Chiefs",
      image: null,
    },
  ]);
  assert.deepEqual(parseSearchResults(null), []);
});

test("a followed player's team, position and headshot", () => {
  assert.deepEqual(
    parseAthleteForFollow({
      athlete: {
        team: { id: 12, displayName: "Kansas City Chiefs" },
        position: { abbreviation: "QB" },
        headshot: { href: "https://a/h.png" },
      },
    }),
    { teamId: "12", teamName: "Kansas City Chiefs", headshot: "https://a/h.png", position: "QB" },
  );
  assert.deepEqual(parseAthleteForFollow(undefined), { teamId: null, teamName: null, headshot: null, position: null });
});
