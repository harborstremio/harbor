import assert from "node:assert/strict";
import test from "node:test";
import { hookHarness } from "./helpers/hook-harness.ts";

const args = { metaId: "tt100", authKey: "fixture", season: 1, episode: 1, imdbId: null, imdbVerified: false, openingVid: "tt100:1:1" };
function harness(local: any, patch: any = {}, privateProfile: string | null = null) {
  const writes: any[] = []; let reads = 0;
  const { state, ...rest } = patch;
  const remote = { _id: "tt100", _mtime: new Date(10000).toISOString(), ...rest, state: {
    video_id: "tt100:1:1", season: 1, episode: 1, timeOffset: 600000, duration: 1800000, flaggedWatched: 1, ...state,
  } };
  const h = hookHarness("src/lib/player/resume-start.ts", "resolveStartMs", {
    "@/lib/resume": { readResumeEntry: () => local, saveResumeBatch: (batch: any) => writes.push(...batch) },
    "@/lib/cw-profile": { privateCwProfileId: () => privateProfile },
    "@/lib/stremio": { libraryGetOne: async () => { reads++; return remote; }, episodeFromVideoId: () => ({ season: 1, episode: 1 }) },
  });
  return { run: () => h.render(args), writes, get reads() { return reads; } };
}

test("a stale watched flag cannot erase a fresh mid-episode local resume", async () => {
  const h = harness({ ms: 300000, t: 20000 });
  assert.deepEqual(await h.run(), { ms: 300000, finished: false, fromRemote: false });
  assert.equal(h.writes.length, 0);
});
test("newer remote mid-episode progress can resume despite its historical watched flag", async () => {
  const h = harness({ ms: 300000, t: 5000 });
  assert.deepEqual(await h.run(), { ms: 600000, finished: false, fromRemote: true });
});
test("newer completion restarts while older completion cannot override a rewatch", async () => {
  for (const localTime of [5000, 20000]) {
    const h = harness({ ms: 300000, t: localTime }, { state: { timeOffset: 1750000 } });
    assert.equal((await h.run()).finished, localTime < 10000);
  }
});
test("a library metadata edit cannot outrank the actual watch timestamp", async () => {
  const h = harness({ ms: 300000, t: 20000 }, { _mtime: new Date(40000).toISOString(), state: { lastWatched: new Date(5000).toISOString() } });
  assert.equal((await h.run()).ms, 300000);
});
test("imported percentage uses the real runtime when local progress wins", async () => {
  const h = harness({ ms: 9999999, pct: 0.4, t: 20000 });
  assert.deepEqual(await h.run(), { ms: 720000, finished: false, fromRemote: false });
});
test("remote progress from a different episode cannot replace local progress", async () => {
  const h = harness({ ms: 300000, t: 5000 }, { state: { episode: 2, video_id: "tt100:1:2" } });
  assert.deepEqual(await h.run(), { ms: 300000, finished: false, fromRemote: false });
});
test("private profiles never use another profile's cloud resume", async () => {
  const h = harness({ ms: 300000, t: 5000 }, {}, "private");
  assert.equal((await h.run()).ms, 300000); assert.equal(h.reads, 0);
});
