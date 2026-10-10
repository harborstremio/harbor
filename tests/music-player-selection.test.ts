import assert from "node:assert/strict";
import test from "node:test";
import { createMusicPlaybackSelection } from "../src/lib/music/player-selection";
import type { MusicPlayerState } from "../src/lib/music/types";

test("clock updates do not rebuild catalog subscribers; playback and library changes do", () => {
  let state: MusicPlayerState = { phase: "playing", current: null, currentTime: 0,
    duration: 200, volume: .8, queue: [], queueIndex: 0, likedIds: [], likedTracks: [], recents: [], error: null };
  const read = createMusicPlaybackSelection(() => state);
  const first = read();
  for (let tick = 1; tick <= 300; tick++) {
    state = { ...state, currentTime: tick / 5 };
    assert.equal(read(), first);
  }
  assert.ok(!("currentTime" in first), "no stale clock may leak into a transport consumer");
  for (const patch of [{ phase: "paused" as const }, { likedIds: ["liked"] }, { queue: [] },
    { recents: [] }, { duration: 240 }, { error: "failed" }, { volume: .5 }]) {
    const before = read(); state = { ...state, ...patch };
    assert.notEqual(read(), before);
    assert.equal(read(), read());
  }
});
