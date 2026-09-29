import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const meta = { id: "series:one", name: "One Series", poster: "poster.jpg" };
const torrentUrl = "http://127.0.0.1:9000/stream/abc123/4";
const downloadStorageKey = "harbor.downloads.v1";

function loadTs(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => {
      assert.ok(id in mocks, `unexpected require: ${id}`);
      return mocks[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fixture({ stored = null, holdTorrentAdd = false } = {}) {
  const storage = new Map();
  if (stored) storage.set(downloadStorageKey, JSON.stringify(stored));
  const files = new Set();
  const transfers = [];
  const engineCalls = [];
  const torrentAdded = deferred();
  const pendingTorrentAdd = holdTorrentAdd ? deferred() : null;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
  };
  const videoDownload = {
    startDownload(id, url, path, onProgress, headers) {
      const task = deferred();
      const transfer = { id, url, path, onProgress, headers, task, abortCalls: 0 };
      transfers.push(transfer);
      return {
        promise: task.promise,
        abort: () => {
          transfer.abortCalls++;
        },
      };
    },
  };
  const engine = {
    localEngineStreamRef(url) {
      const match = /\/stream\/([^/]+)\/(\d+)$/.exec(url);
      return match ? { infoHash: match[1], fileIdx: Number(match[2]) } : null;
    },
    pauseTorrentUsage() {},
    releaseTorrentUsage() {},
    retainTorrentUsage() {},
    torrentEnginePause() {},
    torrentEngineSelectSet() {},
    torrentEngineAdd: async (magnet, _files, fileIdx) => {
      engineCalls.push({ magnet, fileIdx });
      if (pendingTorrentAdd) return pendingTorrentAdd.promise;
      return torrentAdded.promise;
    },
  };
  const mocks = {
    "@tauri-apps/api/path": {
      downloadDir: async () => "C:/Downloads",
      join: async (...parts) => parts.join("/"),
    },
    "@tauri-apps/plugin-fs": {
      exists: async (path) => files.has(path),
      mkdir: async () => {},
      remove: async (path) => files.delete(path),
    },
    "@tauri-apps/plugin-opener": { revealItemInDir: async () => {} },
    react: { useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot() },
    "./filename": {
      buildDefaultFilename: (_meta, episode) =>
        episode ? `One-S${episode.season}E${episode.episode}.mkv` : "One.mkv",
      sanitizeName: (value) => value,
    },
    "@/lib/platform": { isWindowsDesktop: () => false },
    "@/lib/torrent/local-engine": engine,
    "./video-download": videoDownload,
  };
  const api = loadTs("../src/lib/download/downloads-store.ts", mocks);
  return {
    api,
    files,
    transfers,
    engineCalls,
    torrentAdded,
    pendingTorrentAdd,
    async enqueue(
      url = "https://cdn.example/video.mkv",
      headers = { Referer: "https://addon.test" },
    ) {
      const id = await api.enqueueDownload({
        meta,
        episode: { season: 1, episode: 2, imdbSeason: 1, imdbEpisode: 2, name: "Two" },
        streamLabel: "1080p",
        url,
        headers,
        destinationPath: "C:/Downloads/two.mkv",
      });
      await flush();
      return id;
    },
  };
}

function finishTransfer(transfer) {
  transfer.onProgress({ receivedBytes: 100, totalBytes: 100, ratio: 1 });
  transfer.task.resolve();
}

function interruptedRecord(overrides = {}) {
  return {
    id: "saved-id",
    metaId: meta.id,
    title: meta.name,
    subtitle: "S1 · E02 · Two",
    poster: meta.poster,
    season: 1,
    episode: 2,
    streamLabel: "1080p",
    url: "https://cdn.example/video.mkv",
    requestHeaders: { Referer: "https://addon.test", Authorization: "Bearer sample" },
    torrentInfoHash: null,
    torrentFileIdx: null,
    path: "C:/Downloads/two.mkv",
    status: "interrupted",
    receivedBytes: 42,
    totalBytes: 100,
    ratio: 0.42,
    bytesPerSec: 0,
    error: null,
    startedAt: 100,
    kind: "video",
    retry: null,
    ...overrides,
  };
}

test("retries failed and hydrated interrupted downloads with the same id, path, and headers", async () => {
  const f = fixture();
  const id = await f.enqueue();
  const original = f.api.downloadsSnapshot()[0];
  assert.equal(original.status, "downloading");
  f.transfers[0].task.reject(new Error("connection reset"));
  await flush();
  assert.equal(f.api.downloadsSnapshot()[0].status, "error");
  await f.api.retryDownload(id);
  assert.equal(f.transfers.length, 2);
  assert.equal(f.transfers[1].id, id);
  assert.equal(f.transfers[1].path, original.path);
  assert.deepEqual(f.transfers[1].headers, original.requestHeaders);
  finishTransfer(f.transfers[1]);
  await flush();
  assert.equal(f.api.downloadsSnapshot()[0].status, "done");

  const hydrated = fixture({ stored: [interruptedRecord()] });
  const before = hydrated.api.downloadsSnapshot()[0];
  assert.equal(before.status, "interrupted");
  await hydrated.api.retryDownload(before.id);
  assert.equal(hydrated.transfers.length, 1);
  assert.equal(hydrated.transfers[0].id, before.id);
  assert.equal(hydrated.transfers[0].path, before.path);
  assert.deepEqual(hydrated.transfers[0].headers, before.requestHeaders);
});

test("concurrent retry requests start exactly one new transfer", async () => {
  const f = fixture();
  const id = await f.enqueue();
  f.transfers[0].task.reject(new Error("offline"));
  await flush();
  await Promise.all([f.api.retryDownload(id), f.api.retryDownload(id), f.api.retryDownload(id)]);
  assert.equal(f.transfers.length, 2);
});

test("retry waits for the old transfer cleanup before starting another transfer", async () => {
  const f = fixture();
  const id = await f.enqueue();
  f.api.cancelDownload(id);
  const retry = f.api.retryDownload(id);
  await flush();
  assert.equal(f.transfers[0].abortCalls, 1);
  assert.equal(f.transfers.length, 1);
  f.transfers[0].task.reject(Object.assign(new Error("canceled"), { name: "AbortError" }));
  await retry;
  assert.equal(f.transfers.length, 2);
  assert.equal(f.transfers[1].id, id);
  assert.equal(f.transfers[1].path, "C:/Downloads/two.mkv");
  assert.deepEqual(f.transfers[1].headers, { Referer: "https://addon.test" });
});

test("removing an item while its torrent is being re-added cannot restart the removed download", async () => {
  const record = interruptedRecord({
    url: torrentUrl,
    torrentInfoHash: "abc123",
    torrentFileIdx: 4,
  });
  const f = fixture({ stored: [record], holdTorrentAdd: true });
  const retry = f.api.retryDownload(record.id);
  await flush();
  assert.equal(f.engineCalls.length, 1);
  f.api.removeDownload(record.id);
  f.pendingTorrentAdd.resolve({
    stream_base: "http://127.0.0.1:9123/stream",
    info_hash: "ABC123",
  });
  await retry;
  assert.equal(f.transfers.length, 0);
  assert.equal(f.api.downloadsSnapshot().length, 0);
});

test("canceling while a torrent is being re-added cannot start the transfer", async () => {
  const record = interruptedRecord({
    url: torrentUrl,
    torrentInfoHash: "abc123",
    torrentFileIdx: 4,
  });
  const f = fixture({ stored: [record], holdTorrentAdd: true });
  const retry = f.api.retryDownload(record.id);
  await flush();
  assert.equal(f.engineCalls.length, 1);
  assert.equal(f.api.downloadsSnapshot()[0].status, "downloading");
  f.api.cancelDownload(record.id);
  f.pendingTorrentAdd.resolve({
    stream_base: "http://127.0.0.1:9123/stream",
    info_hash: "ABC123",
  });
  await retry;
  assert.equal(f.transfers.length, 0);
  assert.equal(f.api.downloadsSnapshot()[0].status, "canceled");
});

test("torrent retry rebuilds the stream URL with the current engine port and hash", async () => {
  const record = interruptedRecord({
    url: torrentUrl,
    torrentInfoHash: "abc123",
    torrentFileIdx: 4,
  });
  const f = fixture({ stored: [record] });
  f.torrentAdded.resolve({
    stream_base: "http://127.0.0.1:9123/stream",
    info_hash: "DEF456",
  });
  await f.api.retryDownload(record.id);
  assert.deepEqual(f.engineCalls, [{ magnet: "magnet:?xt=urn:btih:abc123", fileIdx: 4 }]);
  assert.equal(f.transfers[0].url, "http://127.0.0.1:9123/stream/def456/4");
});

test("done downloads and ebooks cannot be retried", async () => {
  const done = interruptedRecord({ status: "done" });
  const ebook = interruptedRecord({
    id: "ebook-id",
    status: "error",
    kind: "ebook",
    format: "epub",
    url: "harbor-ebook://book/epub",
  });
  const f = fixture({ stored: [done, ebook] });
  assert.equal(
    f.api.canRetryDownload(f.api.downloadsSnapshot().find((d) => d.id === done.id)),
    false,
  );
  assert.equal(
    f.api.canRetryDownload(f.api.downloadsSnapshot().find((d) => d.id === ebook.id)),
    false,
  );
  await f.api.retryDownload(done.id);
  await f.api.retryDownload(ebook.id);
  assert.equal(f.transfers.length, 0);
  assert.equal(f.engineCalls.length, 0);
});

test("retry progress is exposed and clears on subsequent progress and successful completion", async () => {
  const f = fixture();
  const id = await f.enqueue();
  f.transfers[0].onProgress({ receivedBytes: 42, totalBytes: 100, ratio: 0.42 });
  f.transfers[0].onProgress({
    receivedBytes: 0,
    totalBytes: null,
    ratio: 0,
    retry: { attempt: 2, delaySeconds: 4 },
  });
  assert.deepEqual(f.api.downloadsSnapshot()[0].retry, { attempt: 2, delaySeconds: 4 });
  assert.equal(f.api.downloadsSnapshot()[0].receivedBytes, 42);
  assert.equal(f.api.downloadsSnapshot()[0].totalBytes, 100);
  assert.equal(f.api.downloadsSnapshot()[0].ratio, 0.42);
  f.transfers[0].onProgress({ receivedBytes: 20, totalBytes: 100, ratio: 0.2 });
  assert.equal(f.api.downloadsSnapshot()[0].retry, null);
  f.transfers[0].onProgress({
    receivedBytes: 30,
    totalBytes: 100,
    ratio: 0.3,
    retry: { attempt: 3, delaySeconds: 8 },
  });
  finishTransfer(f.transfers[0]);
  await flush();
  assert.equal(f.api.downloadsSnapshot()[0].status, "done");
  assert.equal(f.api.downloadsSnapshot()[0].retry, null);
  assert.equal(f.api.downloadsSnapshot()[0].requestHeaders, undefined);
  assert.equal(f.api.downloadsSnapshot()[0].id, id);
});

test("resume clears retry progress after the paused native transfer has cleaned up", async () => {
  const f = fixture();
  const id = await f.enqueue();
  f.transfers[0].onProgress({
    receivedBytes: 15,
    totalBytes: 100,
    ratio: 0.15,
    retry: { attempt: 2, delaySeconds: 4 },
  });
  f.api.pauseDownload(id);
  assert.equal(f.api.downloadsSnapshot()[0].status, "paused");
  assert.equal(f.api.downloadsSnapshot()[0].retry, null);
  const resumed = f.api.resumeDownload(id);
  f.transfers[0].task.reject(Object.assign(new Error("paused"), { name: "AbortError" }));
  await resumed;
  assert.equal(f.transfers.length, 2);
  assert.equal(f.api.downloadsSnapshot()[0].status, "downloading");
  assert.equal(f.api.downloadsSnapshot()[0].retry, null);
  finishTransfer(f.transfers[1]);
  await flush();
  assert.equal(f.api.downloadsSnapshot()[0].status, "done");
});

test("video download waits for native cleanup after an early done, error, or canceled event", async () => {
  for (const event of [
    { kind: "done", received: 100 },
    { kind: "error", message: "network failure" },
    { kind: "canceled", received: 50 },
  ]) {
    let channel;
    const invokeTask = deferred();
    const api = loadTs("../src/lib/download/video-download.ts", {
      "@tauri-apps/api/core": {
        Channel: class {
          constructor() {
            channel = this;
          }
        },
        invoke: () => invokeTask.promise,
      },
    });
    const handle = api.startDownload("id", "url", "path", () => {});
    let settled = false;
    handle.promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    channel.onmessage(event);
    await flush();
    assert.equal(settled, false, `${event.kind} settled before native cleanup`);
    invokeTask.resolve();
    if (event.kind === "done") await handle.promise;
    else await assert.rejects(handle.promise);
    assert.equal(settled, true);
  }
});

test("video download ignores delayed channel progress after native cleanup", async () => {
  let channel;
  const invokeTask = deferred();
  const progress = [];
  const api = loadTs("../src/lib/download/video-download.ts", {
    "@tauri-apps/api/core": {
      Channel: class {
        constructor() {
          channel = this;
        }
      },
      invoke: () => invokeTask.promise,
    },
  });
  const handle = api.startDownload("id", "url", "path", (value) => progress.push(value));
  channel.onmessage({ kind: "progress", received: 25, total: 100 });
  assert.equal(progress.length, 1);
  invokeTask.resolve();
  await handle.promise;
  const settledProgress = [...progress];

  // A delayed event from the old native transfer must not replace the state
  // emitted by a new retry for the same download id.
  channel.onmessage({ kind: "retrying", attempt: 4, delaySeconds: 7 });
  channel.onmessage({ kind: "progress", received: 5, total: 100 });
  assert.deepEqual(progress, settledProgress);
});
