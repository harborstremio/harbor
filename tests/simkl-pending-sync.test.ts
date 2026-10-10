// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  armPendingFlush,
  flushPendingWatches,
  listPendingWatches,
  recordPendingWatch,
} from "../src/lib/simkl/pending-sync.ts";

function clearPending() {
  localStorage.removeItem("harbor.simkl.pendingwatched.v1.default");
}

test("watches without a usable identity are not queued", () => {
  clearPending();
  recordPendingWatch("", { season: 1, episode: 2 });
  recordPendingWatch("tt1234567", { season: 1, episode: 0 });
  recordPendingWatch("tt1234567", { season: -1, episode: 2 });
  assert.deepEqual(listPendingWatches(), []);
});

test("movie watches without season or episode queue as movies", () => {
  clearPending();
  recordPendingWatch("tt1234567", undefined);
  const list = listPendingWatches();
  assert.equal(list.length, 1);
  assert.equal(list[0].metaId, "tt1234567");
  assert.equal(list[0].episode, undefined);
  clearPending();
});

test("failed terminal watches are recorded and survive a reload", () => {
  clearPending();
  recordPendingWatch("tt1234567", { season: 2, episode: 5 }, "tt1234567");
  const list = listPendingWatches();
  assert.equal(list.length, 1);
  assert.equal(list[0].metaId, "tt1234567");
  assert.equal(list[0].episode?.season, 2);
  assert.equal(list[0].episode?.episode, 5);
  assert.equal(list[0].imdb, "tt1234567");
});

test("full episode identity survives the round trip", () => {
  clearPending();
  recordPendingWatch(
    "kitsu:1",
    { season: 1, episode: 2, imdbSeason: 1, imdbEpisode: 2, tvdbEpisodeId: 999 },
    "tt1234567",
  );
  const list = listPendingWatches();
  assert.equal(list.length, 1);
  assert.equal(list[0].episode?.imdbSeason, 1);
  assert.equal(list[0].episode?.imdbEpisode, 2);
  assert.equal(list[0].episode?.tvdbEpisodeId, 999);
  clearPending();
});

test("re-recording the same episode replaces instead of duplicating", () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  assert.equal(listPendingWatches().length, 1);
});

test("different episodes queue independently", () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  recordPendingWatch("kitsu:1", { season: 1, episode: 3 });
  assert.equal(listPendingWatches().length, 2);
});

test("flush with no session is a no-op that preserves entries", async () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  const r = await flushPendingWatches({
    hasSession: () => false,
    stopScrobble: async () => true,
    recordWatched: async () => true,
  });
  assert.equal(r.flushed, 0);
  assert.equal(r.remaining, 1);
  assert.equal(listPendingWatches().length, 1);
  clearPending();
});

test("flush replays the terminal stop before the history write", async () => {
  clearPending();
  const stops: Array<{ metaId: string; episode?: { season: number; episode: number } }> = [];
  const watched: Array<{
    metaId: string;
    episode?: { season: number; episode: number };
    imdb?: string;
  }> = [];
  const deps = {
    hasSession: () => true,
    stopScrobble: async (
      metaId: string,
      episode: { season: number; episode: number } | undefined,
    ) => {
      stops.push({ metaId, episode });
      return metaId !== "tt0000000";
    },
    recordWatched: async (
      metaId: string,
      episode: { season: number; episode: number } | undefined,
      imdb?: string,
    ) => {
      watched.push({ metaId, episode, imdb });
      return metaId !== "tt0000000";
    },
  };
  recordPendingWatch("kitsu:1", { season: 1, episode: 2, tvdbEpisodeId: 999 }, "tt1234567");
  recordPendingWatch("tt0000000", { season: 1, episode: 1 });
  const r = await flushPendingWatches(deps);
  assert.equal(r.flushed, 1);
  assert.equal(r.remaining, 1);
  assert.deepEqual(stops, [
    { metaId: "tt0000000", episode: { season: 1, episode: 1 } },
    { metaId: "kitsu:1", episode: { season: 1, episode: 2, tvdbEpisodeId: 999 } },
  ]);
  assert.deepEqual(watched, [
    { metaId: "tt0000000", episode: { season: 1, episode: 1 }, imdb: undefined },
    {
      metaId: "kitsu:1",
      episode: { season: 1, episode: 2, tvdbEpisodeId: 999 },
      imdb: "tt1234567",
    },
  ]);
  assert.equal(listPendingWatches().length, 1);
  assert.equal(listPendingWatches()[0].metaId, "tt0000000");
  clearPending();
});

test("an entry Simkl already lists as watched clears without any write", async () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  const stops: string[] = [];
  const watched: string[] = [];
  const r = await flushPendingWatches({
    hasSession: () => true,
    isWatched: async () => true,
    stopScrobble: async (metaId) => {
      stops.push(metaId);
      return true;
    },
    recordWatched: async (metaId) => {
      watched.push(metaId);
      return true;
    },
  });
  assert.equal(r.flushed, 1);
  assert.equal(r.remaining, 0);
  assert.deepEqual(stops, [], "a watched entry must not be stop-scrobbled again");
  assert.deepEqual(watched, [], "a watched entry must not be written to history again");
  assert.equal(listPendingWatches().length, 0);
  clearPending();
});

test("without an active playback session the replay records without a stop scrobble", async () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  const stops: string[] = [];
  const r = await flushPendingWatches({
    hasSession: () => true,
    isWatched: async () => false,
    hasActivePlayback: async () => false,
    stopScrobble: async (metaId) => {
      stops.push(metaId);
      return true;
    },
    recordWatched: async () => true,
  });
  assert.equal(r.flushed, 1);
  assert.deepEqual(stops, [], "a stop without a live session would re-mark an unmarked item");
  assert.equal(listPendingWatches().length, 0);
  clearPending();
});

test("an active playback session still replays the terminal stop and either write clears", async () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  const r = await flushPendingWatches({
    hasSession: () => true,
    isWatched: async () => false,
    hasActivePlayback: async () => true,
    stopScrobble: async () => true,
    recordWatched: async () => false,
  });
  assert.equal(r.flushed, 1, "a full-progress stop means Simkl holds the watch");
  assert.equal(listPendingWatches().length, 0);
  clearPending();
});

test("a watch that no write confirms stays queued for the next attempt", async () => {
  clearPending();
  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  const r = await flushPendingWatches({
    hasSession: () => true,
    isWatched: async () => false,
    hasActivePlayback: async () => false,
    stopScrobble: async () => false,
    recordWatched: async () => false,
  });
  assert.equal(r.flushed, 0);
  assert.equal(r.remaining, 1);
  assert.equal(listPendingWatches().length, 1);
  clearPending();
});

test("online arming is safe without a window", () => {
  const off = armPendingFlush({
    hasSession: () => false,
    stopScrobble: async () => false,
    recordWatched: async () => false,
  });
  assert.equal(typeof off, "function");
  off();
});

test("hook queues failed stops and provider flushes on session", () => {
  const hook = readFileSync(new URL("../src/lib/simkl/scrobble-hook.ts", import.meta.url), "utf8");
  assert.match(hook, /recordPendingWatch\(prev\.metaId, prev\.episode,/);
  assert.match(hook, /recordPendingWatch\(a\.metaId, a\.episode,/);
  const provider = readFileSync(new URL("../src/lib/simkl/provider.tsx", import.meta.url), "utf8");
  assert.match(provider, /armPendingFlush\(\{/);
  assert.match(provider, /stopScrobble:/);
  assert.match(provider, /simklScrobble\("stop", metaId, episode, 100\)/);
  assert.match(provider, /flushPendingWatches\(\)/);
});

test("the armed replay retries on a clock, not only on the next launch", () => {
  const src = readFileSync(new URL("../src/lib/simkl/pending-sync.ts", import.meta.url), "utf8");
  assert.match(src, /window\.setInterval\(attemptFlush, RETRY_INTERVAL_MS\)/);
  assert.match(src, /scheduleSoon\(\)/);
  assert.match(src, /window\.setTimeout\(\(\) => \{/);
  // A 409 means the watch is already recorded; treating it as failure would
  // leave the entry queued forever.
  const scrobble = readFileSync(new URL("../src/lib/simkl/scrobble.ts", import.meta.url), "utf8");
  assert.match(scrobble, /action === "stop" && e instanceof SimklApiError && e\.status === 409/);
});
