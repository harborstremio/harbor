import assert from "node:assert/strict";
import test from "node:test";
import { freshContinuationTracks, loadMusicContinuation, type ContinuationDependencies } from "../src/lib/music/queue-continuation";
import type { MusicTrack } from "../src/lib/music/types";

const track = (id: string, title = id, connectorId = "spotify"): MusicTrack => ({ id, title, artist: "Artist", connectorId, artwork: "", durationSeconds: 180, durationLabel: "3:00" });
const seed = track("playing");
const api: ContinuationDependencies = {
  playlist: async () => { throw Error("unexpected playlist"); },
  catalog: async () => { throw Error("unexpected catalog"); },
  spotify: async () => { throw Error("unexpected spotify"); },
  discover: async () => { throw Error("unexpected discover"); },
  source: async () => { throw Error("unexpected source"); },
};
const base = { mode: "context" as const, origin: null, current: seed, queue: [seed], history: [] };

test("Spotify continuation follows its cursor even when audio is playing from YouTube", async () => {
  const calls: unknown[] = [];
  const playing = { ...track("youtube-resolved", "Different metadata", "youtube_music"), collectionOrigin: { id: seed.id, connectorId: "spotify" } };
  const result = await loadMusicContinuation({ ...base, current: playing, queue: [playing],
    origin: { kind: "spotify", id: "spotify:playlist:original", name: "Original mix", collection: "playlist", nextOffset: 50 } }, {
    ...api, spotify: async (kind, offset, id) => {
      calls.push([kind, offset, id]);
      return offset === 50 ? { tracks: [seed], nextOffset: 100 } : { tracks: [track("next"), track("next")], nextOffset: 150 };
    },
  });
  assert.deepEqual(calls, [["playlist", 50, "spotify:playlist:original"], ["playlist", 100, "spotify:playlist:original"]]);
  assert.deepEqual(result.tracks.map(t => t.id), ["next"]);
  assert.equal(result.origin?.kind === "spotify" && result.origin.nextOffset, 150);
});

test("discovery excludes queued, previously heard, cross-provider duplicates, and videos", async () => {
  const heard = track("heard", "Old song"), queued = track("queued");
  const result = await loadMusicContinuation({ ...base, mode: "discover", queue: [seed, queued], history: [heard] }, {
    ...api, discover: async (current, excluded) => {
      assert.equal(current, seed);
      assert.ok(excluded.includes(heard));
      return [seed, queued, track("duplicate", "Old song", "deezer"), track("fresh"), track("fresh2", "fresh", "youtube_music"), { ...track("video"), mediaKind: "video" }];
    },
  });
  assert.deepEqual(result.tracks.map(t => t.id), ["fresh"]);
});

test("same playlist may add songs heard before, but never repeats existing queue entries", async () => {
  const heard = track("heard");
  const origin = { kind: "playlist" as const, id: "local-list", name: "My list" };
  const result = await loadMusicContinuation({ ...base, origin, history: [heard] }, { ...api, playlist: async id => {
    assert.equal(id, origin.id); return [seed, heard];
  } });
  assert.deepEqual(result.tracks, [heard]);
  assert.deepEqual(freshContinuationTracks(result.tracks, [seed, heard]), [], "recheck live queue before appending");
});

test("exhausted playlists do not silently switch to recommendations", async () => {
  const result = await loadMusicContinuation({ ...base, origin: { kind: "spotify", id: "liked", name: "Liked", collection: "liked", nextOffset: null } }, api);
  assert.deepEqual(result.tracks, []);
  assert.equal(result.exhausted, true);
});

test("provider failures and broken cursors remain retryable errors", async () => {
  const request = { ...base, origin: { kind: "spotify" as const, id: "liked", name: "Liked", collection: "liked" as const, nextOffset: 50 } };
  await assert.rejects(loadMusicContinuation(request, { ...api, spotify: async () => ({ tracks: [], nextOffset: 50 }) }), /pagination/);
  await assert.rejects(loadMusicContinuation(request, { ...api, spotify: async () => { throw Error("offline"); } }), /offline/);
});

test("a contextless track uses its original provider, and duplicate-page scanning is bounded", async () => {
  const current = { ...track("youtube", "Song", "youtube_music"), collectionOrigin: { id: "spotify-original", connectorId: "spotify" } };
  await loadMusicContinuation({ ...base, current }, { ...api, source: async (_, connector) => { assert.equal(connector, "spotify"); return []; } });
  let calls = 0;
  const result = await loadMusicContinuation({ ...base, origin: { kind: "spotify", id: "liked", name: "Liked", collection: "liked", nextOffset: 0 } }, {
    ...api, spotify: async (_, offset) => { calls++; return { tracks: [seed], nextOffset: offset + 50 }; },
  });
  assert.equal(calls, 4);
  assert.equal(result.exhausted, false);
  assert.equal(result.origin?.kind === "spotify" && result.origin.nextOffset, 200);
});
