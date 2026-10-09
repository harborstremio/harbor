import assert from "node:assert/strict";
import test from "node:test";
import { createMusicVideoSurfaces } from "../src/lib/music/video-surfaces.ts";
import type { MusicTrack } from "../src/lib/music/types.ts";

const song = (id: string): MusicTrack => ({
  id,
  connectorId: "youtube",
  title: id,
  artist: "Artist",
  artwork: "",
  durationSeconds: 180,
  durationLabel: "3:00",
  mediaKind: "video",
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("expand, collapse, and reopen move the visible surface without reloading or stopping", async () => {
  const calls: string[] = [];
  const store = createMusicVideoSurfaces(async (track, signal) => {
    calls.push(`load:${track.id}`);
    signal.addEventListener("abort", () => calls.push(`stop:${track.id}`));
  });
  const watch = Symbol(),
    expanded = Symbol();
  const closeWatch = store.register(watch, song("a"));
  await flush();
  assert.equal(store.getSnapshot().status, "playing");
  let closeExpanded = store.register(expanded, song("a"), 1);
  await flush();
  assert.equal(store.getSnapshot().owner, expanded);
  closeExpanded();
  await flush();
  assert.equal(store.getSnapshot().owner, watch);
  closeExpanded = store.register(expanded, song("a"), 1);
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  closeWatch();
  closeExpanded();
  await flush();
  assert.deepEqual(calls, ["load:a", "stop:a"]);
  assert.equal(store.getSnapshot().status, "idle");
});

test("handoff during resolution and same-commit remount retain the pending load", async () => {
  let ready!: () => void;
  let loads = 0;
  let stops = 0;
  const store = createMusicVideoSurfaces(async (_, signal) => {
    loads++;
    signal.addEventListener("abort", () => stops++);
    await new Promise<void>((resolve) => {
      ready = resolve;
    });
  });
  const closeWatch = store.register(Symbol(), song("a"));
  await flush();
  closeWatch();
  const expanded = Symbol();
  const closeExpanded = store.register(expanded, song("a"), 1);
  await flush();
  assert.equal(loads, 1);
  assert.equal(stops, 0);
  ready();
  await flush();
  assert.equal(store.getSnapshot().owner, expanded);
  assert.equal(store.getSnapshot().status, "playing");
  closeExpanded();
  await flush();
  assert.equal(stops, 1);
});

test("late old source success/failure cannot replace the newly selected video", async () => {
  const ready = new Map<string, () => void>();
  const fail = new Map<string, () => void>();
  const store = createMusicVideoSurfaces(async (track, _, failed) => {
    fail.set(track.id, failed);
    await new Promise<void>((resolve) => ready.set(track.id, resolve));
  });
  const owner = Symbol();
  const old = store.register(owner, song("a"));
  await flush();
  old();
  const current = store.register(owner, song("b"));
  await flush();
  ready.get("a")!();
  fail.get("a")!();
  await flush();
  assert.equal(store.getSnapshot().key, "youtube:b");
  assert.equal(store.getSnapshot().status, "loading");
  ready.get("b")!();
  await flush();
  assert.equal(store.getSnapshot().status, "playing");
  current();
  await flush();
});

test("failure keeps a retryable surface, retry opens only the selected source", async () => {
  let loads = 0;
  let failed!: () => void;
  const store = createMusicVideoSurfaces(async (_, __, fail) => {
    loads++;
    failed = fail;
  });
  const close = store.register(Symbol(), song("a"));
  await flush();
  failed();
  assert.equal(store.getSnapshot().status, "unavailable");
  store.retry();
  await flush();
  assert.equal(loads, 2);
  assert.equal(store.getSnapshot().status, "playing");
  close();
  await flush();
});

test("minimising the last surface holds the decoder, reopening re-attaches it unreloaded", async () => {
  const calls: string[] = [];
  let release!: () => void;
  let cancels = 0;
  const store = createMusicVideoSurfaces(
    async (track, signal) => {
      calls.push(`load:${track.id}`);
      signal.addEventListener("abort", () => calls.push(`stop:${track.id}`));
    },
    (fire) => {
      release = fire;
      return () => {
        cancels++;
      };
    },
  );
  const close = store.register(Symbol(), song("a"));
  await flush();
  assert.equal(store.getSnapshot().status, "playing");
  close();
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  assert.equal(store.getSnapshot().owner, null);
  assert.equal(store.getSnapshot().status, "playing");
  assert.equal(store.getSnapshot().key, "youtube:a");
  const reopened = Symbol();
  const closeReopened = store.register(reopened, song("a"), 1);
  await flush();
  assert.equal(cancels, 1);
  assert.equal(store.getSnapshot().owner, reopened);
  assert.deepEqual(calls, ["load:a"]);
  closeReopened();
  await flush();
  release();
  await flush();
  assert.deepEqual(calls, ["load:a", "stop:a"]);
  assert.equal(store.getSnapshot().status, "idle");
  assert.equal(cancels, 2);
});

test("a track change during the hold cancels it and swaps the decoder once", async () => {
  const calls: string[] = [];
  let cancels = 0;
  const store = createMusicVideoSurfaces(
    async (track, signal) => {
      calls.push(`load:${track.id}`);
      signal.addEventListener("abort", () => calls.push(`stop:${track.id}`));
    },
    () => () => {
      cancels++;
    },
  );
  const close = store.register(Symbol(), song("a"));
  await flush();
  close();
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  const closeNext = store.register(Symbol(), song("b"));
  await flush();
  assert.equal(cancels, 1);
  assert.deepEqual(calls, ["load:a", "stop:a", "load:b"]);
  assert.equal(store.getSnapshot().key, "youtube:b");
  assert.equal(store.getSnapshot().status, "playing");
  closeNext();
  await flush();
});

test("a hold that releases while a surface is back leaves the decoder alone", async () => {
  const calls: string[] = [];
  let release!: () => void;
  const store = createMusicVideoSurfaces(
    async (track, signal) => {
      calls.push(`load:${track.id}`);
      signal.addEventListener("abort", () => calls.push(`stop:${track.id}`));
    },
    (fire) => {
      release = fire;
      return () => {};
    },
  );
  const close = store.register(Symbol(), song("a"));
  await flush();
  close();
  await flush();
  const back = Symbol();
  const closeBack = store.register(back, song("a"));
  await flush();
  release();
  await flush();
  assert.deepEqual(calls, ["load:a"]);
  assert.equal(store.getSnapshot().owner, back);
  assert.equal(store.getSnapshot().status, "playing");
  closeBack();
  await flush();
  release();
  await flush();
  assert.deepEqual(calls, ["load:a", "stop:a"]);
});

test("a settled failure survives a surface handoff and only retry reloads", async () => {
  let loads = 0;
  let failed!: () => void;
  const store = createMusicVideoSurfaces(async (_, __, fail) => {
    loads++;
    failed = fail;
  });
  const watch = Symbol(),
    expanded = Symbol();
  const closeWatch = store.register(watch, song("a"));
  await flush();
  failed();
  assert.equal(store.getSnapshot().status, "unavailable");
  const closeExpanded = store.register(expanded, song("a"), 1);
  await flush();
  assert.equal(loads, 1);
  assert.equal(store.getSnapshot().owner, expanded);
  assert.equal(store.getSnapshot().status, "unavailable");
  store.retry();
  await flush();
  assert.equal(loads, 2);
  assert.equal(store.getSnapshot().owner, expanded);
  assert.equal(store.getSnapshot().status, "playing");
  closeExpanded();
  closeWatch();
  await flush();
});

test("an unregister with no decoder never asks the hold", async () => {
  let holds = 0;
  const store = createMusicVideoSurfaces(
    async () => {},
    () => {
      holds++;
      return () => {};
    },
  );
  const close = store.register(Symbol(), song("a"));
  close();
  await flush();
  assert.equal(holds, 0);
  assert.equal(store.getSnapshot().status, "idle");
});
