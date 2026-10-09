import assert from "node:assert/strict";
import test from "node:test";
import { pinnedSourceKey } from "../src/lib/music/pinned-sources";
import { shouldResolvePreferredSource } from "../src/lib/music/source-version";
import type { MusicTrack } from "../src/lib/music/types";

function track(patch: Partial<MusicTrack>): MusicTrack {
  return {
    id: "a1",
    title: "Camilla",
    artist: "Basshunter",
    artwork: "",
    durationSeconds: 195,
    durationLabel: "3:15",
    ...patch,
  } as MusicTrack;
}

test("a song is keyed by the recording, not by the upload that answered for it", () => {
  const key = pinnedSourceKey(track({}));
  assert.equal(key, "basshunter|camilla");
  assert.equal(pinnedSourceKey(track({ id: "other", connectorId: "soundcloud" })), key);
  assert.equal(pinnedSourceKey(track({ title: "  CAMILLA  " })), key);
});

test("a song missing either half of its identity is never pinned", () => {
  assert.equal(pinnedSourceKey(track({ artist: "" })), "");
  assert.equal(pinnedSourceKey(track({ title: "" })), "");
});

test("a stream url from another service no longer outranks the preferred source", () => {
  const stored = track({ connectorId: "soundcloud", playbackUrl: "https://cdn.sndcdn.com/x.mp3" });
  assert.equal(shouldResolvePreferredSource(stored, "youtube", false, false), true);
});

test("a file on disk is still played as-is, never re-resolved", () => {
  for (const url of ["file:///song.mp3", "blob:harbor/abc", "data:audio/mp3;base64,AA"]) {
    const local = track({ connectorId: "soundcloud", playbackUrl: url });
    assert.equal(shouldResolvePreferredSource(local, "youtube", false, false), false);
  }
});

test("an explicit choice and a retry still bypass re-resolution", () => {
  const stored = track({ connectorId: "soundcloud", playbackUrl: "https://cdn.sndcdn.com/x.mp3" });
  assert.equal(shouldResolvePreferredSource(stored, "youtube", true, false), false);
  assert.equal(shouldResolvePreferredSource(stored, "youtube", false, true), false);
});

test("a track already on the preferred source is left alone", () => {
  const stored = track({ connectorId: "youtube", playbackUrl: "https://example/y.m4a" });
  assert.equal(shouldResolvePreferredSource(stored, "youtube", false, false), false);
});
