import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  getMusicPlaybackOrigin,
  musicTitleTarget,
  recordMusicPlaylistPlayback,
  setMusicPlaybackOrigin,
  beginMusicQueue,
  registerMusicQueueOrigin,
  getMusicQueueRevision,
} from "../src/lib/music/playback-origin.ts";
import type { MusicTrack } from "../src/lib/music/types";

test("queue provenance survives source resolution but does not leak to a different queue", () => {
  const track: MusicTrack = { id: "spotify-track", connectorId: "spotify", title: "Song", artist: "Artist", artwork: "", durationSeconds: 100, durationLabel: "1:40" };
  const resolved: MusicTrack = { ...track, id: "youtube-track", connectorId: "youtube_music", collectionOrigin: { id: track.id, connectorId: track.connectorId } };
  const origin = { kind: "spotify" as const, id: "original-list", name: "Original", collection: "playlist" as const, nextOffset: 50 };
  registerMusicQueueOrigin([track], origin);
  beginMusicQueue([resolved], []);
  assert.deepEqual(getMusicPlaybackOrigin(), origin);
  const revision = getMusicQueueRevision();
  beginMusicQueue([resolved], [resolved]);
  assert.equal(getMusicQueueRevision(), revision, "advancing within the same queue preserves continuation requests");
  beginMusicQueue([{ ...track, id: "different" }], [resolved]);
  assert.equal(getMusicPlaybackOrigin(), null);
  assert.ok(getMusicQueueRevision() > revision, "a different queue invalidates pending additions");
});

const src = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${path}`, import.meta.url)), "utf8");
const dock = src("components/music/music-dock.tsx");
const libraryParts = src("components/music/music-library-parts.tsx");

test("a playlist origin sends the dock title back to that playlist", () => {
  assert.deepEqual(musicTitleTarget({ kind: "playlist", id: "pl-42", name: "Late night" }), {
    kind: "playlist",
    playlistId: "pl-42",
  });
});

test("no origin sends the dock title to the album", () => {
  assert.deepEqual(musicTitleTarget(null), { kind: "album" });
});

test("an origin with no usable id falls back to the album rather than opening nothing", () => {
  assert.deepEqual(musicTitleTarget({ kind: "playlist", id: "", name: "Broken" }), {
    kind: "album",
  });
});

test("origin is recorded when playback starts inside a playlist", () => {
  setMusicPlaybackOrigin(null);
  recordMusicPlaylistPlayback({ id: "pl-7", name: "Drive" });
  assert.deepEqual(getMusicPlaybackOrigin(), { kind: "playlist", id: "pl-7", name: "Drive" });
  assert.deepEqual(musicTitleTarget(getMusicPlaybackOrigin()), {
    kind: "playlist",
    playlistId: "pl-7",
  });
});

test("origin is cleared when playback starts from something that is not a playlist", () => {
  setMusicPlaybackOrigin({ kind: "playlist", id: "pl-7", name: "Drive" });
  recordMusicPlaylistPlayback(null);
  assert.equal(getMusicPlaybackOrigin(), null);
  assert.deepEqual(musicTitleTarget(getMusicPlaybackOrigin()), { kind: "album" });
  setMusicPlaybackOrigin({ kind: "playlist", id: "pl-7", name: "Drive" });
  recordMusicPlaylistPlayback(undefined);
  assert.equal(getMusicPlaybackOrigin(), null);
});

test("the dock title decides through the shared helper, not its own inline branch", () => {
  assert.ok(
    dock.includes("musicTitleTarget(getMusicPlaybackOrigin())"),
    "music-dock.tsx must route the title click through musicTitleTarget",
  );
  assert.ok(
    dock.includes("requestMusicPlaylist(target.playlistId, display.id)"),
    "playlist targets must still open the playlist at the track",
  );
});

test("the dock never hands an unresolved artist ref to the explore request", () => {
  const offenders = dock
    .split("\n")
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((entry) => entry.line.includes("primaryArtist"));
  assert.deepEqual(
    offenders.map((entry) => `${entry.index + 1}: ${entry.line}`),
    [],
    "dock artist navigation must fall through to goToArtist/resolveArtist, not shortcut past the authority",
  );
});

test("every library playback path records or clears the origin", () => {
  assert.ok(
    !libraryParts.includes("setMusicPlaybackOrigin"),
    "library parts must go through recordMusicPlaylistPlayback",
  );
  assert.ok(
    !libraryParts.includes("?? openSourcePicker"),
    "no library play path may start playback with a stale origin",
  );
  assert.equal((libraryParts.match(/recordMusicPlaylistPlayback\(/g) ?? []).length, 3);
});
