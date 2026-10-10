import assert from "node:assert/strict";
import test from "node:test";
import { playbackParams, playbackPersistenceHarness } from "./helpers/playback-persistence-harness.ts";

const params = (season = 1, episode = 1) => ({ ...playbackParams(season, episode), authKey: "fixture-only", resolutionSettled: true });
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("cloud transition cleanup keeps the outgoing source and duration with its video ID", async () => {
  const h = playbackPersistenceHarness("cloud");
  const first = params(); h.render(first); await settle();
  h.render({ ...first, snap: { ...first.snap, status: "playing", positionSec: 300, durationSec: 3600 } });
  h.clock(300); h.tick(); await settle();
  h.cloudWrites.length = 0;
  const next = params(2, 1); h.clock(0); h.render(next); await settle();
  const outgoing = h.cloudWrites.find(v => v[7] === "tt100:1:1");
  assert.ok(outgoing);
  assert.equal(outgoing[1].url, first.src.url);
  assert.equal(outgoing[1].episode.season, 1);
  assert.equal(outgoing[2].durationSec, 3600);
  assert.equal(outgoing[5], 300);
});

test("cloud exit before an incoming episode loads cannot send old progress for it", async () => {
  const h = playbackPersistenceHarness("cloud");
  const first = params(); h.render(first); await settle();
  h.render({ ...first, snap: { ...first.snap, status: "playing", positionSec: 3500, durationSec: 3600 } });
  h.clock(3500); h.tick(); await settle();
  h.cloudWrites.length = 0;
  const next = params(1, 2);
  h.render({ ...next, snap: { ...first.snap, status: "loading", positionSec: 3500, durationSec: 3600 } });
  h.pagehide(); await settle();
  assert.equal(h.cloudWrites.some(v => v[1].episode.episode === 2 && v[5] > 6), false);
});

test("cloud sync resumes normally after the new episode loads", async () => {
  const h = playbackPersistenceHarness("cloud");
  const first = params(); h.render(first); await settle();
  h.render({ ...first, snap: { ...first.snap, status: "playing", positionSec: 300, durationSec: 3600 } });
  h.clock(300); h.tick(); await settle();
  const next = params(1, 2); h.clock(0); h.render(next); await settle();
  h.cloudWrites.length = 0;
  h.render({ ...next, snap: { ...next.snap, status: "playing", positionSec: 320, durationSec: 3360 } });
  h.clock(320); h.tick(); await settle();
  assert.ok(h.cloudWrites.some(v => v[1].episode.episode === 2 && v[2].durationSec === 3360 && v[5] === 320));
});

test("switching sources while already loading still permits the next playback's progress", async () => {
  const h = playbackPersistenceHarness("cloud");
  h.render(params()); await settle();
  const next = params(1, 2); h.render(next); await settle();
  h.render({ ...next, snap: { ...next.snap, status: "playing", positionSec: 300, durationSec: 3360 } });
  h.clock(300); h.tick(); await settle();
  assert.ok(h.cloudWrites.some(v => v[1].episode.episode === 2 && v[5] === 300));
});

test("late canonical ID resolution does not require a second player loading reset", async () => {
  const h = playbackPersistenceHarness("cloud");
  const p = params();
  p.src = { ...p.src, meta: { ...p.src.meta, id: "tmdb:tv:100" } };
  p.resolvedImdbId = null; p.resolvedImdbVerified = false; p.resolutionSettled = false;
  h.render(p); await settle();
  p.snap = { ...p.snap, status: "playing", positionSec: 300, durationSec: 3360 };
  h.render(p); h.clock(300);
  h.render({ ...p, resolvedImdbId: "tt100", resolvedImdbVerified: true, resolutionSettled: true });
  await settle(); h.tick(); await settle();
  assert.ok(h.cloudWrites.some(v => v[4] === "tt100" && v[5] === 300));
});

test("a delayed periodic cloud read cannot overwrite progress after playback switches", async () => {
  const h = playbackPersistenceHarness("cloud");
  const first = params(); h.render(first); await settle();
  h.render({ ...first, snap: { ...first.snap, status: "playing", positionSec: 300, durationSec: 3600 } });
  h.clock(300);
  let finishRead: ((value: unknown) => void) | undefined;
  h.setCloudRead(() => new Promise(resolve => { finishRead = resolve; }));
  h.tick();
  assert.ok(finishRead, "the previous episode's periodic cloud read is pending");
  h.clock(0); h.render(params(1, 2)); await settle();
  h.cloudWrites.length = 0;
  finishRead({ _id: "tt100", name: "Test series", state: {} }); await settle();
  assert.equal(h.cloudWrites.length, 0);
});
