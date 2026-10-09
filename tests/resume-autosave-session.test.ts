import assert from "node:assert/strict";
import test from "node:test";
import { playbackParams, playbackPersistenceHarness as resumeAutosaveHarness } from "./helpers/playback-persistence-harness.ts";

test("unrelated rerenders cannot replace the live clock with a stale snapshot before exit", () => {
  const h = resumeAutosaveHarness();
  const p = playbackParams(); h.render(p);
  const playing = { ...p, snap: { ...p.snap, status: "playing", positionSec: 30, durationSec: 3600 } };
  h.render(playing);
  h.clock(605);
  h.render({ ...playing, snap: { ...playing.snap, subText: "A new subtitle" } });
  h.clock(0);
  h.unmount();
  assert.equal(h.writes.at(-1)?.[1], 605000);
});

test("seeking backwards saves the actual new position instead of the furthest position", () => {
  const h = resumeAutosaveHarness();
  const p = playbackParams(); h.render(p);
  const playing = { ...p, snap: { ...p.snap, status: "playing", positionSec: 600, durationSec: 3600 } };
  h.render(playing); h.clock(600); h.clock(120); h.render(playing);
  h.clock(0); h.unmount();
  assert.equal(h.writes.at(-1)?.[1], 120000);
});

test("episode transition cleanup saves the old source with its old season and duration", () => {
  const h = resumeAutosaveHarness();
  let first = playbackParams(); h.render(first);
  first = { ...first, snap: { ...first.snap, status: "playing", positionSec: 300, durationSec: 3600 } };
  h.render(first); h.clock(300); h.tick();
  const second = playbackParams(2, 1);
  h.clock(0); h.render(second);
  const saved = h.writes.at(-1);
  assert.deepEqual(saved?.slice(0, 4), ["tt100", 300000, 1, 1]);
  assert.equal(saved?.[4], 1, "do not use the incoming episode's mapped season");
  assert.equal(h.history.at(-1)?.[2], 1, "history must belong to the outgoing season");
  assert.equal(h.watched.length, 0);
});

test("an outgoing episode cannot be finished using the incoming episode's shorter duration", () => {
  const h = resumeAutosaveHarness();
  let first = playbackParams(); h.render(first);
  first = { ...first, snap: { ...first.snap, status: "playing", positionSec: 300, durationSec: 3600 } };
  h.render(first); h.clock(300);
  const next = playbackParams(1, 2);
  h.clock(0);
  h.render({ ...next, snap: { ...next.snap, status: "playing", durationSec: 300 } });
  assert.equal(h.watched.length, 0);
  assert.equal(h.writes.at(-1)?.[1], 300000);
});

test("a new episode ignores the previous playing snapshot until the player resets", () => {
  const h = resumeAutosaveHarness();
  let first = playbackParams(); h.render(first);
  first = { ...first, snap: { ...first.snap, status: "playing", positionSec: 3500, durationSec: 3600 } };
  h.render(first); h.clock(3500); h.tick();
  const next = playbackParams(1, 2);
  h.render({ ...next, snap: first.snap }); h.tick(); h.pagehide();
  assert.equal(h.watched.some(v => v[2] === 2), false, "old progress must not finish the new episode");
  assert.equal(h.writes.some(v => v[3] === 2), false, "old progress must not seed its resume offset");
  h.clock(0); h.render(next);
  h.render({ ...next, snap: { ...next.snap, status: "playing", positionSec: 300, durationSec: 3360 } });
  h.clock(300); h.tick();
  assert.ok(h.writes.some(v => v[3] === 2 && v[1] === 300000));
  assert.equal(h.watched.some(v => v[2] === 2), false);
});

test("teardown after the clock resets keeps the last valid position and snapshot", () => {
  const h = resumeAutosaveHarness();
  let p = playbackParams(); h.render(p);
  p = { ...p, snap: { ...p.snap, status: "playing", positionSec: 305, durationSec: 3600 } };
  h.render(p); h.clock(305); h.clock(0); h.unmount();
  assert.deepEqual(h.writes.at(-1)?.slice(0, 4), ["tt100", 305000, 1, 1]);
  assert.equal(h.watched.length, 0);
});

test("normal completion still records the watched episode and clears its resume entry", () => {
  const h = resumeAutosaveHarness();
  let p = playbackParams(); h.render(p);
  p = { ...p, snap: { ...p.snap, status: "playing", positionSec: 3500, durationSec: 3600 } };
  h.render(p); h.clock(3500); h.tick();
  assert.deepEqual(h.watched[0], ["tt100", 1, 1, true]);
  assert.deepEqual(h.cleared[0], ["tt100", 1, 1, "fixture"]);
  assert.equal(h.synced[0]?.[1], "tt100");
});

test("loading with stale telemetry cannot save progress for an episode that never starts", () => {
  const h = resumeAutosaveHarness();
  const first = playbackParams(); h.render(first);
  h.render({ ...first, snap: { ...first.snap, status: "playing", positionSec: 3500, durationSec: 3600 } });
  h.clock(3500); h.tick();
  const next = playbackParams(1, 2);
  h.render({ ...next, snap: { ...next.snap, status: "loading", positionSec: 3500, durationSec: 3600 } });
  h.pagehide(); h.unmount();
  assert.equal(h.watched.some(v => v[2] === 2), false);
  assert.equal(h.writes.some(v => v[3] === 2), false);
});

test("an ended event losing duration cannot turn five minutes into a completed hour", () => {
  const h = resumeAutosaveHarness();
  const p = playbackParams(); h.render(p);
  h.render({ ...p, snap: { ...p.snap, status: "playing", positionSec: 300, durationSec: 3600 } });
  h.clock(300); h.clock(0);
  h.render({ ...p, snap: { ...p.snap, status: "ended", positionSec: 300, durationSec: 0 } });
  assert.equal(h.watched.length, 0);
  assert.equal(h.writes.at(-1)?.[1], 300000);
});

test("outgoing anime tracker sync uses its own resolved ID and reaches both trackers", async () => {
  const h = resumeAutosaveHarness(); h.enableAnimeSync();
  const p = playbackParams();
  p.src.meta.id = "tmdb:tv:100";
  h.render(p);
  h.render({ ...p, snap: { ...p.snap, status: "playing", positionSec: 3300, durationSec: 3600 } });
  h.clock(3300); h.clock(0);
  h.render(playbackParams(2, 1, { resolvedImdbId: "tt200" }));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.identityRequests[0]?.slice(0, 2), ["tmdb:tv:100", "tt100"]);
  assert.deepEqual(h.trackerProgress.map(v => v.slice(0, 3)), [
    ["anilist", "kitsu:99", 1], ["mal", "kitsu:99", 1],
  ]);
});
