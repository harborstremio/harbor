// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import "./_localstorage-stub.ts";
import {
  armOnlineFlush,
  flushPendingStops,
  listPendingStops,
  recordPendingStop,
} from "../src/lib/trakt/pending-sync.ts";

function clearPending() {
  localStorage.removeItem("harbor.trakt.pendingstops.v1.default");
}

test("failed terminal stops below the watched threshold are not queued", () => {
  clearPending();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 40);
  assert.deepEqual(listPendingStops(), []);
});

test("failed terminal stops are recorded and survive a reload", () => {
  clearPending();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 100);
  const list = listPendingStops();
  assert.equal(list.length, 1);
  assert.equal(list[0].metaId, "tt1234567");
  assert.deepEqual(list[0].episode, { season: 1, episode: 2 });
  assert.equal(list[0].progress, 100);
});

test("re-recording the same episode replaces instead of duplicating", () => {
  clearPending();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 85);
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 100);
  const list = listPendingStops();
  assert.equal(list.length, 1);
  assert.equal(list[0].progress, 100);
});

test("different episodes queue independently", () => {
  clearPending();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 100);
  recordPendingStop("tt1234567", { season: 1, episode: 3 }, 100);
  assert.equal(listPendingStops().length, 2);
});

test("flush with no session is a no-op that preserves entries", async () => {
  clearPending();
  recordPendingStop("tt1234567", { season: 1, episode: 2 }, 100);
  const r = await flushPendingStops();
  assert.equal(r.flushed, 0);
  assert.equal(r.remaining, 1);
  assert.equal(listPendingStops().length, 1);
  clearPending();
});

test("online arming is safe without a window", () => {
  const off = armOnlineFlush();
  assert.equal(typeof off, "function");
  off();
});

test("provider records failed stops and flushes on session", () => {
  const src = readFileSync(new URL("../src/lib/trakt/provider.tsx", import.meta.url), "utf8");
  assert.match(src, /recordPendingStop\(args\.metaId, args\.episode, progress\)/);
  assert.match(src, /armOnlineFlush\(\{/);
  assert.match(src, /flushPendingStops\(\)/);
});

test("flush uses injected deps and honors session gate", async () => {
  clearPending();
  let commits = 0;
  const deps = {
    hasSession: () => true,
    resolveTarget: () => ({ kind: "movie", ids: { imdb: "tt1234567" } }) as const,
    commit: async () => {
      commits += 1;
      return "recorded" as const;
    },
  };
  recordPendingStop("tt1234567", undefined, 100);
  assert.equal(listPendingStops().length, 1);
  const r = await flushPendingStops(deps);
  assert.equal(commits, 1);
  assert.equal(r.flushed, 1);
  assert.equal(r.remaining, 0);
  assert.equal(listPendingStops().length, 0);
  clearPending();
});
