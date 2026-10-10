import test from "node:test";
import assert from "node:assert/strict";
import { createSnippetSession, createSnippetSessionManager } from "../src/lib/music/snippet-session-state.ts";
import { beginMusicSourceRequest, musicSourceRequestMatches } from "../src/lib/music/source-request.ts";
import type { MusicPlayerState, MusicTrack } from "../src/lib/music/types.ts";

const track: MusicTrack = { id: "song", title: "Song", artist: "Artist", artwork: "", durationSeconds: 180, durationLabel: "3:00" };
function harness(phase: MusicPlayerState["phase"] = "playing") {
  let state: MusicPlayerState = { current: track, phase, queue: [track], queueIndex: 0, currentTime: 42, duration: 180, volume: .5, error: null, likedIds: [], likedTracks: [], recents: [] };
  const listeners = new Set<() => void>();
  let toggles = 0;
  const deps = { getMusicState: () => state, subscribeMusic: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, toggleMusicPlayback: () => { toggles++; } };
  return { deps, get toggles() { return toggles; }, get state() { return state; }, update(next: Partial<MusicPlayerState>) { state = { ...state, ...next }; listeners.forEach(fn => fn()); } };
}
test("a preview pauses and resumes the original song without replacing its queue or position", async () => {
  const h = harness(), before = h.state;
  const session = createSnippetSession(h.deps);
  assert.equal(h.toggles, 1);
  h.update({ phase: "paused" });
  assert.equal(await session.ready, true);
  session.close(); session.close();
  assert.equal(h.toggles, 2);
  assert.equal(h.state.queue, before.queue);
  assert.equal(h.state.currentTime, 42);
});
test("closing before pause acknowledgement resumes once acknowledgement arrives", async () => {
  const h = harness(), session = createSnippetSession(h.deps);
  session.close(); h.update({ phase: "paused" });
  assert.equal(await session.ready, true); assert.equal(h.toggles, 2);
});
test("a delayed native pause acknowledgement still restores playback after the preview closes", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness(), session = createSnippetSession(h.deps);
  context.mock.timers.tick(4500);
  h.update({ phase: "paused" });
  assert.equal(await session.ready, true);
  session.close();
  assert.equal(h.toggles, 2);
});
test("a resolving main song is paused once it starts, before preview playback is allowed", async () => {
  const h = harness("resolving"), session = createSnippetSession(h.deps);
  assert.equal(h.toggles, 0);
  h.update({ phase: "playing" }); assert.equal(h.toggles, 1);
  h.update({ phase: "paused" }); assert.equal(await session.ready, true);
  session.close(); assert.equal(h.toggles, 2);
});
test("development remounts share one pause and restore only after the last owner closes", async () => {
  const h = harness(), begin = createSnippetSessionManager(h.deps);
  const first = begin(); first.close();
  const second = begin(); await Promise.resolve();
  assert.equal(h.toggles, 1);
  h.update({ phase: "paused" }); assert.equal(await second.ready, true);
  assert.equal(h.toggles, 1);
  second.close(); await Promise.resolve(); assert.equal(h.toggles, 2);
});
test("a previously paused song stays paused, and full-song handoff never resumes the old song", async () => {
  const paused = harness("paused"), untouched = createSnippetSession(paused.deps);
  assert.equal(await untouched.ready, true); untouched.close(); assert.equal(paused.toggles, 0);
  const h = harness(), session = createSnippetSession(h.deps);
  session.close(false); h.update({ phase: "paused" }); await session.ready; assert.equal(h.toggles, 1);
});
test("an external track change is not resumed by the preview overlay", async () => {
  const h = harness(), session = createSnippetSession(h.deps);
  h.update({ current: { ...track, id: "other" }, phase: "paused" });
  assert.equal(await session.ready, false); session.close(); assert.equal(h.toggles, 1);
});
test("source lookup matching follows collection identity and does not mark unrelated rows", () => {
  const pending = { ...track, id: "resolved", connectorId: "youtube", collectionOrigin: { id: "song" } };
  assert.equal(musicSourceRequestMatches(pending, track), true);
  assert.equal(musicSourceRequestMatches(pending, { ...track, id: "other" }), false);
  const finish = beginMusicSourceRequest(track);
  finish(); finish(); // Cancellation is idempotent, including after a request supersedes it.
});
