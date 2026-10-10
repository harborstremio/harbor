// A queued Simkl watch must not wait for the next app launch. This drives the
// armed replay with a fake window so the retry clock and the online listener are
// exercised for real, not just asserted against source text.
import assert from "node:assert/strict";
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  armPendingFlush,
  listPendingWatches,
  recordPendingWatch,
} from "../src/lib/simkl/pending-sync.ts";

const intervals = new Map<number, () => void>();
const timeouts = new Map<number, () => void>();
const listeners = new Map<string, Set<() => void>>();
let nextId = 1;

(globalThis as { window?: unknown }).window = {
  setInterval: (fn: () => void) => {
    const id = nextId++;
    intervals.set(id, fn);
    return id;
  },
  clearInterval: (id: number) => {
    intervals.delete(id);
  },
  setTimeout: (fn: () => void) => {
    const id = nextId++;
    timeouts.set(id, fn);
    return id;
  },
  clearTimeout: (id: number) => {
    timeouts.delete(id);
  },
  addEventListener: (event: string, fn: () => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)?.add(fn);
  },
  removeEventListener: (event: string, fn: () => void) => {
    listeners.get(event)?.delete(fn);
  },
};
// Node exposes a read-only `navigator` whose `onLine` is undefined, which the
// replay treats as "not known to be offline" — exactly what these tests want.

const PENDING_KEY = "harbor.simkl.pendingwatched.v1.default";
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tickClock = () => {
  for (const fn of intervals.values()) fn();
};
const goOnline = () => {
  for (const fn of listeners.get("online") ?? []) fn();
};

test("the retry clock replays a queued watch and clears it once accepted", async () => {
  localStorage.removeItem(PENDING_KEY);
  const calls: string[] = [];
  const off = armPendingFlush({
    hasSession: () => true,
    stopScrobble: async (metaId) => {
      calls.push(`stop:${metaId}`);
      return true;
    },
    recordWatched: async (metaId) => {
      calls.push(`hist:${metaId}`);
      return true;
    },
  });
  assert.ok(intervals.size > 0, "a retry clock is armed");

  recordPendingWatch("kitsu:1", { season: 1, episode: 2 });
  assert.equal(listPendingWatches().length, 1);

  tickClock();
  await settle();

  assert.deepEqual(calls, ["stop:kitsu:1", "hist:kitsu:1"]);
  assert.equal(listPendingWatches().length, 0, "the entry clears once both writes land");
  off();
});

test("a watch that no write confirms stays queued for the next tick", async () => {
  localStorage.removeItem(PENDING_KEY);
  const off = armPendingFlush({
    hasSession: () => true,
    stopScrobble: async () => false,
    recordWatched: async () => false,
  });
  recordPendingWatch("kitsu:2", { season: 1, episode: 3 });

  tickClock();
  await settle();

  assert.equal(listPendingWatches().length, 1, "an unconfirmed write is never dropped");
  off();
});

test("regaining the connection replays without waiting for a clock tick", async () => {
  localStorage.removeItem(PENDING_KEY);
  let writes = 0;
  const off = armPendingFlush({
    hasSession: () => true,
    stopScrobble: async () => true,
    recordWatched: async () => {
      writes += 1;
      return true;
    },
  });
  recordPendingWatch("kitsu:3", { season: 1, episode: 4 });

  goOnline();
  await settle();

  assert.equal(writes, 1);
  assert.equal(listPendingWatches().length, 0);
  off();
});

test("disarming stops the clock and the listener", async () => {
  localStorage.removeItem(PENDING_KEY);
  const off = armPendingFlush({
    hasSession: () => true,
    stopScrobble: async () => true,
    recordWatched: async () => true,
  });
  const before = intervals.size;
  assert.ok(before > 0);
  off();
  assert.equal(intervals.size, before - 1, "the retry clock is cleared");
  assert.equal((listeners.get("online") ?? new Set()).size, 0, "the listener is removed");
});

test("a queued watch is retried shortly after it is recorded", async () => {
  localStorage.removeItem(PENDING_KEY);
  let writes = 0;
  const off = armPendingFlush({
    hasSession: () => true,
    stopScrobble: async () => true,
    recordWatched: async () => {
      writes += 1;
      return true;
    },
  });
  recordPendingWatch("kitsu:4", { season: 1, episode: 5 });

  assert.ok(timeouts.size > 0, "a quick second chance is scheduled");
  for (const fn of timeouts.values()) fn();
  await settle();

  assert.equal(writes, 1);
  assert.equal(listPendingWatches().length, 0);
  off();
});
