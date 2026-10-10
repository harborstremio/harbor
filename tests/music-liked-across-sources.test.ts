import test from "node:test";
import assert from "node:assert/strict";
import { isMusicLiked, likedIdsFor, withoutLiked } from "../src/lib/music/liked";
import type { MusicTrack } from "../src/lib/music/types";

const track = (id: string, origin?: string) =>
  ({
    id,
    connectorId: "youtube_music",
    title: id,
    artist: "A",
    durationSeconds: 1,
    durationLabel: "0:01",
    collectionOrigin: origin ? { id: origin, connectorId: "catalog" } : undefined,
  }) as MusicTrack;

test("a song liked from a playlist still reads as liked once it plays from another source", () => {
  assert.equal(isMusicLiked(["catalog-id"], track("ytm-id", "catalog-id")), true);
});

test("liking the resolved track is still recognised", () => {
  assert.equal(isMusicLiked(["ytm-id"], track("ytm-id", "catalog-id")), true);
});

test("an unrelated song is not falsely liked", () => {
  assert.equal(isMusicLiked(["something-else"], track("ytm-id", "catalog-id")), false);
  assert.equal(isMusicLiked([], track("ytm-id")), false);
});

test("a track with no collection matches on its own id only", () => {
  assert.deepEqual(likedIdsFor(track("solo")), ["solo"]);
});

test("unliking clears every id that identifies the song, so it cannot come back", () => {
  const ids = ["catalog-id", "ytm-id", "other"];
  assert.deepEqual(withoutLiked(ids, track("ytm-id", "catalog-id")), ["other"]);
});

test("a missing track is never liked and never throws", () => {
  assert.equal(isMusicLiked(["a"], null), false);
  assert.deepEqual(likedIdsFor(undefined), []);
});
