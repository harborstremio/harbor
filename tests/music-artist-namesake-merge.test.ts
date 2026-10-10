import test from "node:test";
import assert from "node:assert/strict";
import { mergeMusicSearchLanes, type MusicSearchLane } from "../src/lib/music/sources";
import type { MusicArtistRef } from "../src/lib/music/types";

const artist = (
  id: string,
  name: string,
  connectorId = "catalog",
  subtitle?: string,
): MusicArtistRef => ({ id, connectorId, name, subtitle });

const lane = (id: string, artists: MusicArtistRef[]): MusicSearchLane => ({
  id,
  results: { tracks: [], albums: [], artists, playlists: [] },
});

test("four Deezer artists all named King Von survive as four distinct rows", () => {
  const deezer = lane("catalog", [
    artist("deezer:artist:222422125", "King Von"),
    artist("deezer:artist:115195732", "King Von"),
    artist("deezer:artist:119988042", "King Von"),
    artist("deezer:artist:12431462", "King Von"),
  ]);
  const merged = mergeMusicSearchLanes([deezer], 32);
  assert.equal(merged.artists.length, 4, "a namesake collapse starves the authority of candidates");
  assert.deepEqual(
    merged.artists.map((entry) => entry.id),
    [
      "deezer:artist:222422125",
      "deezer:artist:115195732",
      "deezer:artist:119988042",
      "deezer:artist:12431462",
    ],
  );
  assert.ok(
    merged.artists.some((entry) => entry.id === "deezer:artist:12431462"),
    "the 306k fan King Von must reach the ranker",
  );
  assert.deepEqual(
    merged.artists.map((entry) => entry.sourceRank),
    [0, 1, 2, 3],
    "each row keeps its own lane position",
  );
  assert.ok(
    merged.artists.every((entry) => entry.sourceCount === 1),
    "one provider record is one source, never a merged identity claim",
  );
});

test("identity across sources is not the merge layer's job", () => {
  const ytm = lane("youtube", [
    artist("ytm:artist:abc", "King Von", "youtube", "Artist • 21.6M monthly audience"),
  ]);
  const deezer = lane("catalog", [
    artist("deezer:artist:222422125", "King Von"),
    artist("deezer:artist:12431462", "King Von"),
  ]);
  const merged = mergeMusicSearchLanes([ytm, deezer], 32);
  assert.equal(merged.artists.length, 3, "every provider record survives with its own payload");
  const youtube = merged.artists.find((entry) => entry.id === "ytm:artist:abc");
  assert.ok(youtube, "the YouTube record must survive");
  assert.equal(
    youtube?.subtitle,
    "Artist • 21.6M monthly audience",
    "the audience subtitle is destroyed by a name-keyed collapse",
  );
  assert.ok(
    merged.artists.some((entry) => entry.id === "deezer:artist:12431462"),
    "the real Deezer King Von must not be discarded by a cross-source collapse",
  );
  assert.ok(
    merged.artists.every((entry) => entry.sourceCount === 1),
    "no row may claim two sources agreed on an identity",
  );
});

test("no split key leaks into the merged output", () => {
  const deezer = lane("catalog", [
    artist("deezer:artist:222422125", "King Von"),
    artist("deezer:artist:12431462", "King Von"),
  ]);
  const merged = mergeMusicSearchLanes([deezer], 32);
  assert.ok(
    merged.artists.every((entry) => !entry.id.startsWith("split:")),
    "the provisional splitWithinLane scaffolding must be gone",
  );
  assert.ok(
    merged.artists.every((entry) => (entry.sourceConnectorIds ?? []).join() === "catalog"),
    "provenance stays truthful per row",
  );
});

test("distinct names are untouched", () => {
  const deezer = lane("catalog", [
    artist("deezer:artist:1", "King Von"),
    artist("deezer:artist:2", "Lil Durk"),
  ]);
  assert.equal(mergeMusicSearchLanes([deezer], 32).artists.length, 2);
});
