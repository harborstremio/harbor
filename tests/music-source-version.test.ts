import assert from "node:assert/strict";
import test from "node:test";
import { backingTrackVersion, compatibleVocalVersion, shouldResolvePreferredSource } from "../src/lib/music/source-version";
import type { MusicTrack } from "../src/lib/music/types";
const song = { id: "a", title: "KEEP GOING", artist: "DJ Khaled", connectorId: "soundcloud" } as MusicTrack;
test("vocal songs reject instrumental and karaoke substitutes", () => {
  for (const title of ["KEEP GOING (Instrumental)", "KEEP GOING karaoke", "KEEP GOING - no vocals"]) {
    assert.equal(compatibleVocalVersion(song, { ...song, title }), false);
  }
  assert.equal(compatibleVocalVersion(song, { ...song, title: "KEEP GOING (Official Audio)" }), true);
  assert.equal(backingTrackVersion({ ...song, version: "Instrumental" }), "instrumental");
  const instrumental = { ...song, version: "Instrumental" };
  assert.equal(compatibleVocalVersion(instrumental, instrumental), true);
  assert.equal(compatibleVocalVersion(instrumental, song), false);
});
test("provider tracks still resolve the preferred source, while explicit choices remain intact", () => {
  assert.equal(shouldResolvePreferredSource(song, "youtube-music", false, false), true);
  assert.equal(shouldResolvePreferredSource(song, "soundcloud", false, false), false);
  assert.equal(shouldResolvePreferredSource(song, "youtube-music", true, false), false);
  assert.equal(shouldResolvePreferredSource(song, "youtube-music", false, true), false);
  for (const extra of [{ connectorId: "local" }, { playbackUrl: "file:///song.mp3" }, { mediaKind: "video" as const }]) {
    assert.equal(shouldResolvePreferredSource({ ...song, ...extra }, "youtube-music", false, false), false);
  }
});
