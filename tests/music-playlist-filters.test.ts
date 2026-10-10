import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PLAYLIST_FILTERS as defaults, filterPlaylist, playlistSource, type PlaylistFilters } from "../src/lib/music/playlist-filters.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const tracks: MusicTrack[] = [
  { id: "a", title: "Preach", artist: "Young Dolph", album: "King of Memphis", artwork: "", durationSeconds: 200, durationLabel: "3:20", explicit: true, connectorId: "youtube" },
  { id: "b", title: "Pika Girl", artist: "S3RL", album: "Pika Girl", artwork: "", durationSeconds: 220, durationLabel: "3:40", explicit: false, connectorId: "youtube-music" },
  { id: "c", title: "Écho", artist: "Unknown", artwork: "", durationSeconds: 0, durationLabel: "", connectorId: "soundcloud" },
  { id: "d", title: "Track 10", artist: "Young Dolph", album: "King of Memphis", artwork: "", durationSeconds: 200, durationLabel: "3:20", explicit: false, connectorId: "spotify" },
];
const ids = (change: Partial<PlaylistFilters>, metadata = {}) => filterPlaylist(tracks, { ...defaults, ...change }, metadata).map(t => t.id);
test("search combines title, artist, album and accent-insensitive terms", () => {
  assert.deepEqual(ids({ query: "dolph memphis preach" }), ["a"]);
  assert.deepEqual(ids({ query: "echo" }), ["c"]);
});
test("source aliases share a filter and unknown explicit metadata is not called clean", () => {
  assert.equal(playlistSource(tracks[1]), "youtube");
  assert.deepEqual(ids({ source: "youtube", content: "clean" }), ["b"]);
  assert.deepEqual(ids({ content: "clean" }), ["b", "d"]);
  assert.deepEqual(ids({ content: "explicit" }), ["a"]);
});
test("opening a large playlist does not inspect track text or artist metadata", () => {
  const collection = Array.from({ length: 10_000 }, (_, index) => ({
    ...tracks[0], id: String(index),
    get title(): string { throw new Error("Unnecessary title access"); },
    get artist(): string { throw new Error("Unnecessary artist access"); },
    get album(): string { throw new Error("Unnecessary album access"); },
  }));
  assert.deepEqual(filterPlaylist(collection, defaults).map(track => track.id), collection.map(track => track.id));
});
test("indexed genres intersect search and source without inspecting other tracks", () => {
  const genreTracks = new Map([[116, new Set(["a", "d"])]]);
  assert.deepEqual(ids({ genre: 116 }, { genreTracks }), ["a", "d"]);
  assert.deepEqual(ids({ genre: 116, source: "youtube", query: "preach" }, { genreTracks }), ["a"]);
  assert.deepEqual(ids({ genre: 116 }), []);
});
test("sorting is stable, reversible and does not mutate playlist order", () => {
  const original = tracks.map(t => t.id);
  assert.deepEqual(ids({ sort: "duration" }), ["a", "d", "b", "c"]);
  assert.deepEqual(ids({ sort: "duration", descending: true }), ["b", "a", "d", "c"]);
  assert.deepEqual(ids({ sort: "album", descending: true }), ["b", "a", "d", "c"]);
  assert.deepEqual(tracks.map(t => t.id), original);
});
test("text sorting preserves natural number order", () => {
  const numbered = [10, 2, 1].map(number => ({ ...tracks[0], id: String(number), title: `Track ${number}` }));
  assert.deepEqual(filterPlaylist(numbered, { ...defaults, sort: "title" }).map(track => track.id), ["1", "2", "10"]);
  assert.deepEqual(filterPlaylist(numbered, { ...defaults, sort: "title", descending: true }).map(track => track.id), ["10", "2", "1"]);
});
test("membership dates sort independently of playlist order; missing dates stay last", () => {
  const metadata = { addedAt: { a: "1700000000000", b: "2025-01-01T00:00:00Z", d: "2024-01-01T00:00:00Z" } };
  assert.deepEqual(ids({ sort: "added" }, metadata), ["b", "d", "a", "c"]);
  assert.deepEqual(ids({ sort: "added", descending: true }, metadata), ["a", "d", "b", "c"]);
  assert.deepEqual(ids({ sort: "added", descending: true }, { recentFirst: true }), ["d", "c", "b", "a"]);
});
