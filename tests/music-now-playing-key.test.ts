import assert from "node:assert/strict";
import test from "node:test";
import { adoptRequestedIdentity } from "../src/lib/music/queue-source";
import type { MusicTrack } from "../src/lib/music/types";
import {
  buildNowPlayingKey,
  nowPlayingMatches,
  parseNowPlayingKey,
} from "../src/lib/music/now-playing-key";

const key = (parts: string[]) => parts.join("\n");

test("the key carries identity and phase and nothing that ticks", () => {
  assert.deepEqual(parseNowPlayingKey(key(["spotify", "t1", "", "", "playing"])), {
    id: "t1",
    connectorId: "spotify",
    originId: null,
    originConnectorId: null,
    phase: "playing",
  });
  assert.deepEqual(parseNowPlayingKey(key(["", "t1", "", "", "paused"])), {
    id: "t1",
    connectorId: null,
    originId: null,
    originConnectorId: null,
    phase: "paused",
  });
  assert.deepEqual(parseNowPlayingKey(key(["", "", "", "", "idle"])), {
    id: null,
    connectorId: null,
    originId: null,
    originConnectorId: null,
    phase: "idle",
  });
});

test("a row only lights up for the track actually playing", () => {
  const now = parseNowPlayingKey(key(["spotify", "t1", "", "", "playing"]));
  assert.equal(nowPlayingMatches(now, { id: "t1", connectorId: "spotify" }), true);
  assert.equal(nowPlayingMatches(now, { id: "t1", connectorId: "deezer" }), false);
  assert.equal(nowPlayingMatches(now, { id: "t2", connectorId: "spotify" }), false);
  assert.equal(nowPlayingMatches(now, null), false);
});

test("a local track with no connector still matches itself", () => {
  const now = parseNowPlayingKey(key(["", "local file.flac", "", "", "playing"]));
  assert.equal(nowPlayingMatches(now, { id: "local file.flac" }), true);
  assert.equal(nowPlayingMatches(now, { id: "local file.flac", connectorId: null }), true);
});

test("the row that started playback stays lit after it resolves to another source", () => {
  // Clicking a catalog row plays a YouTube track, so the playing id is not the row's id.
  const now = parseNowPlayingKey(key(["youtube", "yt-9", "catalog", "deezer:42", "playing"]));
  assert.equal(nowPlayingMatches(now, { id: "deezer:42", connectorId: "catalog" }), true);
  assert.equal(nowPlayingMatches(now, { id: "yt-9", connectorId: "youtube" }), true);
  assert.equal(nowPlayingMatches(now, { id: "deezer:99", connectorId: "catalog" }), false);
});

test("the built key round-trips through the parser", () => {
  const built = buildNowPlayingKey(
    { id: "yt-9", connectorId: "youtube", collectionOrigin: { id: "deezer:42", connectorId: "catalog" } },
    "playing",
  );
  assert.deepEqual(parseNowPlayingKey(built), {
    id: "yt-9",
    connectorId: "youtube",
    originId: "deezer:42",
    originConnectorId: "catalog",
    phase: "playing",
  });
});

test("nothing playing lights nothing", () => {
  const now = parseNowPlayingKey(key(["", "", "", "", "idle"]));
  assert.equal(nowPlayingMatches(now, { id: "t1", connectorId: "spotify" }), false);
});

test("a saved source keeps its indicator when playback resolves to a new source", () => {
  const catalog = { id: "catalog:42", connectorId: "catalog" } as MusicTrack;
  const saved = adoptRequestedIdentity({ id: "old-upload", connectorId: "soundcloud" } as MusicTrack, catalog);
  const playing = adoptRequestedIdentity({ id: "new-upload", connectorId: "youtube" } as MusicTrack, saved);
  const now = parseNowPlayingKey(buildNowPlayingKey(playing, "playing"));
  assert.equal(nowPlayingMatches(now, saved), true);
  assert.equal(nowPlayingMatches(now, catalog), true);
  assert.equal(nowPlayingMatches(now, { ...saved, collectionOrigin: { id: "catalog:99", connectorId: "catalog" } }), false);
  assert.equal(nowPlayingMatches(now, { ...saved, collectionOrigin: { id: "catalog:42", connectorId: "spotify" } }), false);
});

test("a saved resolved row also matches playback of its original recording", () => {
  const saved = {
    id: "upload", connectorId: "youtube",
    collectionOrigin: { id: "catalog:42", connectorId: "catalog" },
  };
  for (const phase of ["resolving", "playing", "paused"]) {
    const now = parseNowPlayingKey(buildNowPlayingKey({ id: "catalog:42", connectorId: "catalog" }, phase));
    assert.equal(nowPlayingMatches(now, saved), true);
    assert.equal(now.phase, phase);
  }
  const idle = parseNowPlayingKey(buildNowPlayingKey(null, "idle"));
  assert.equal(nowPlayingMatches(idle, saved), false);
});

test("missing origin connectors match only another missing connector", () => {
  const saved = { id: "saved", connectorId: "local", collectionOrigin: { id: "original" } };
  const now = parseNowPlayingKey(buildNowPlayingKey({ id: "original" }, "playing"));
  assert.equal(nowPlayingMatches(now, saved), true);
  assert.equal(nowPlayingMatches(now, { ...saved, collectionOrigin: { id: "original", connectorId: "local" } }), false);
});
