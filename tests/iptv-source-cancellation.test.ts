import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPlaylistCache,
  getCachedPlaylist,
  loadPlaylist,
  subscribePlaylists,
} from "../src/lib/iptv/store.ts";
import type { IptvPlaylistSource } from "../src/lib/iptv/types.ts";

const source = (id: string): IptvPlaylistSource => ({
  id,
  name: "Synthetic test source",
  kind: "m3u",
  url: "https://example.com/authorized.m3u",
});
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("removing a source cancels a stalled M3U body and permits a fresh retry", async (t) => {
  const src = source("cancel-m3u");
  let cancelled = false;
  let signal: AbortSignal | undefined;
  const stub = t.mock.method(globalThis, "fetch", async (_url, init) => {
    signal = init?.signal as AbortSignal;
    return new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
      }),
    );
  });
  const task = loadPlaylist(src, { force: true });
  const rejected = assert.rejects(task, { name: "AbortError" });
  await flush();
  clearPlaylistCache(src.id);
  await rejected;
  assert.equal(cancelled, true);
  assert.equal(signal?.aborted, true);
  assert.equal(getCachedPlaylist(src.id), null);
  stub.mock.mockImplementation(
    async () => new Response("#EXTM3U\n#EXTINF:-1,ESPN\nhttps://example.com/stream.m3u8"),
  );
  const loaded = await loadPlaylist(src, { force: true });
  assert.equal(loaded.channels.length, 1);
  assert.equal(getCachedPlaylist(src.id)?.loading, undefined);
  clearPlaylistCache(src.id);
});

test("removal while persistent cache is restoring cannot restart a provider request", async (t) => {
  const src = source("cancel-restore");
  const stub = t.mock.method(globalThis, "fetch", async () => new Response("must not fetch"));
  const task = loadPlaylist(src);
  clearPlaylistCache(src.id);
  await assert.rejects(task, { name: "AbortError" });
  assert.equal(stub.mock.callCount(), 0);
  assert.equal(getCachedPlaylist(src.id), null);
});

test("removing an Xtream source also aborts its account request", async (t) => {
  const src: IptvPlaylistSource = {
    ...source("cancel-xtream"),
    kind: "xtream",
    url: "",
    xtream: { server: "https://example.com", username: "test", password: "test-only" },
  };
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    signal = init?.signal as AbortSignal;
    return new Response(new ReadableStream());
  });
  const task = loadPlaylist(src, { force: true });
  const rejected = assert.rejects(task, { name: "AbortError" });
  await flush();
  clearPlaylistCache(src.id);
  await rejected;
  assert.equal(signal?.aborted, true);
  assert.equal(getCachedPlaylist(src.id), null);
});

test("a stalled download times out, clears its pending entry and can be retried", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const src = source("timeout-retry");
  const stub = t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream()));
  const task = loadPlaylist(src, { force: true });
  const rejected = assert.rejects(task, { name: "TimeoutError" });
  await flush();
  t.mock.timers.tick(45_000);
  await rejected;
  assert.equal(getCachedPlaylist(src.id), null);
  stub.mock.mockImplementation(
    async () => new Response("#EXTM3U\n#EXTINF:-1,ESPN\nhttps://example.com/stream.m3u8"),
  );
  assert.equal((await loadPlaylist(src)).channels.length, 1);
  clearPlaylistCache(src.id);
});

test("the bounded download and ingest path still publishes a full 50k playlist progressively", async (t) => {
  const src = source("bounded-50k");
  const text =
    "#EXTM3U\n" +
    Array.from(
      { length: 50_000 },
      (_, i) => `#EXTINF:-1 group-title="Sports",ESPN ${i}\nhttps://example.com/${i}.m3u8`,
    ).join("\n");
  t.mock.method(globalThis, "fetch", async () => new Response(text));
  let partial = false;
  const unsubscribe = subscribePlaylists(() => {
    const current = getCachedPlaylist(src.id);
    if (current?.loading && current.channels.length > 0 && current.channels.length < 50_000)
      partial = true;
  });
  try {
    const result = await loadPlaylist(src, { force: true });
    assert.equal(result.channels.length, 50_000);
    assert.equal(partial, true);
    assert.equal(getCachedPlaylist(src.id)?.loading, undefined);
  } finally {
    unsubscribe();
    clearPlaylistCache(src.id);
  }
});
