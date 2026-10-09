import assert from "node:assert/strict";
import test from "node:test";
import { trackPlaybackState } from "../src/lib/music/track-playback-state";
import { buildNowPlayingKey, parseNowPlayingKey } from "../src/lib/music/now-playing-key";
import type { MusicTrack } from "../src/lib/music/types";
const track = { id: "deezer:85", connectorId: "catalog", title: "E85", artist: "Don Toliver", artwork: "", durationSeconds: 163, durationLabel: "2:43" } satisfies MusicTrack;
const resolved = { ...track, id: "sc-upload", connectorId: "soundcloud", collectionOrigin: track };
const now = (phase: string, current: MusicTrack | null = resolved) => parseNowPlayingKey(buildNowPlayingKey(current, phase));

test("source lookup and player resolution both keep the initiating chart card loading", () => {
  assert.deepEqual(trackPlaybackState(now("idle", null), track, track), { loading: true, current: false, paused: false });
  assert.deepEqual(trackPlaybackState(now("resolving"), null, track), { loading: true, current: true, paused: false });
});
test("Deezer and Billboard origins remain active after resolving to another provider", () => {
  for (const origin of [track, { ...track, id: "billboard:e85" }]) {
    const state = parseNowPlayingKey(buildNowPlayingKey({ ...resolved, collectionOrigin: origin }, "playing"));
    assert.deepEqual(trackPlaybackState(state, null, origin), { loading: false, current: true, paused: false });
    assert.equal(trackPlaybackState(state, null, { ...origin, connectorId: "unrelated" }).current, false);
  }
});
test("pause is static, and errors/stops/cancelled lookups clear the indicator", () => {
  assert.deepEqual(trackPlaybackState(now("paused"), null, track), { loading: false, current: true, paused: true });
  for (const phase of ["idle", "error"]) assert.deepEqual(trackPlaybackState(now(phase), null, track), { loading: false, current: false, paused: false });
  assert.equal(trackPlaybackState(now("playing"), { ...track, id: "different" }, null).loading, false);
  assert.equal(trackPlaybackState(now("playing"), null, { ...track, id: "different" }).current, false);
});
