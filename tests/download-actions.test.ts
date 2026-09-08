import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { DownloadItem } from "../src/lib/download/downloads-store.ts";

type Store = typeof import("../src/lib/download/downloads-store.ts");

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function item(id: string, next: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id,
    metaId: "tt123",
    title: "Fixture",
    subtitle: null,
    poster: null,
    season: 1,
    episode: 2,
    streamLabel: null,
    url: "https://example.test/video.mkv",
    path: `C:/fixtures/${id}.mkv`,
    status: "done",
    receivedBytes: 100,
    totalBytes: 100,
    ratio: 1,
    bytesPerSec: 0,
    error: null,
    startedAt: 1,
    ...next,
  };
}

// Execute the real store; replace only native/network/storage boundaries.
function harness(initial: DownloadItem[] = []) {
  const files = new Map(
    initial.map((d) => [d.path, { isFile: true, canonicalPath: d.path.toLowerCase() }]),
  );
  const removed: string[] = [];
  const revealed: string[] = [];
  const writers = new Map<string, ReturnType<typeof deferred> & { aborted: boolean }>();
  const failures = new Set<string>();
  const storage = { failWrites: false };
  let persisted = JSON.stringify(initial);
  let nextId = 0;
  const invoke = async (command: string, args: { path: string; protectedPaths?: string[] }) => {
    const file = files.get(args.path);
    if (command === "download_file_info") {
      return file
        ? { exists: true, ...file }
        : { exists: false, isFile: false, canonicalPath: null };
    }
    assert.equal(command, "download_delete_file");
    if (failures.has(args.path)) throw new Error("File is locked");
    if (file && !file.isFile) throw new Error("Not a regular file");
    if (file && args.protectedPaths?.some((p) => p.toLowerCase() === file.canonicalPath)) {
      throw new Error("File is in use by the player");
    }
    removed.push(args.path);
    files.delete(args.path);
  };
  const mocks: Record<string, unknown> = {
    "@tauri-apps/api/core": { invoke },
    "@tauri-apps/api/path": { downloadDir: async () => "C:/fixtures" },
    "@tauri-apps/plugin-fs": {
      exists: async (path: string) => files.has(path),
      mkdir: async () => {},
      remove: async (path: string) => {
        if (failures.has(path)) throw new Error("File is locked");
        removed.push(path);
        files.delete(path);
      },
    },
    "@tauri-apps/plugin-opener": {
      revealItemInDir: async (path: string) => {
        revealed.push(path);
      },
    },
    react: { useSyncExternalStore: () => [] },
    "./filename": { buildDefaultFilename: () => "fixture.mkv", sanitizeName: (s: string) => s },
    "./video-download": {
      startDownload: (id: string) => {
        const writer = { ...deferred(), aborted: false };
        writers.set(id, writer);
        return {
          promise: writer.promise,
          abort: () => {
            writer.aborted = true;
          },
        };
      },
    },
    "@/lib/platform": { isWindowsDesktop: () => true },
    "@/lib/torrent/local-engine": {
      localEngineStreamRef: () => null,
      pauseTorrentUsage: () => {},
      releaseTorrentUsage: () => {},
      retainTorrentUsage: () => {},
      torrentEnginePause: async () => {},
      torrentEngineSelectSet: async () => {},
    },
  };
  const source = readFileSync(
    new URL("../src/lib/download/downloads-store.ts", import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "localStorage", "crypto", outputText)(
    (name: string) => {
      assert.ok(Object.hasOwn(mocks, name), name);
      return mocks[name];
    },
    module,
    module.exports,
    {
      getItem: (key: string) => (key === "harbor.downloads.v1" ? persisted : null),
      setItem: (_key: string, value: string) => {
        if (storage.failWrites) throw new Error("Storage quota exceeded");
        persisted = value;
      },
    },
    { randomUUID: () => `new-${++nextId}` },
  );
  return {
    store: module.exports as Store,
    files,
    removed,
    revealed,
    writers,
    failures,
    storage,
    persisted: () => JSON.parse(persisted) as DownloadItem[],
  };
}

test("exact download lookup cannot substitute a duplicate episode copy", async () => {
  const h = harness([item("first"), item("second", { startedAt: 2 })]);
  assert.equal(typeof h.store.completedDownloadById, "function");
  assert.equal((await h.store.completedDownloadById("first")).path, "C:/fixtures/first.mkv");
  h.files.delete("C:/fixtures/first.mkv");
  await assert.rejects(() => h.store.completedDownloadById("first"), /missing|no longer exists/i);
  assert.equal(h.store.downloadsSnapshot().length, 2);
});

test("reveal rejects a missing exact file instead of opening its folder", async () => {
  const h = harness([item("missing")]);
  h.files.clear();
  await assert.rejects(() => h.store.revealDownload("missing"), /missing|no longer exists/i);
  assert.deepEqual(h.revealed, []);
});

test("failed file deletion preserves the download record", async () => {
  const h = harness([item("locked")]);
  h.failures.add("C:/fixtures/locked.mkv");
  await assert.rejects(async () => h.store.removeDownload("locked"), /locked/i);
  assert.equal(h.store.downloadsSnapshot()[0]?.id, "locked");
  assert.equal(h.persisted()[0]?.id, "locked");
});

test("deletion waits for the writer to settle before removing only its exact files", async () => {
  const h = harness();
  const id = await h.store.enqueueDownload({
    meta: { id: "tt123", type: "movie", name: "Fixture" },
    url: "https://example.test/fixture.mkv",
    destinationPath: "C:/fixtures/exact.mkv",
  });
  h.files.set("C:/fixtures/exact.mkv.part", {
    isFile: true,
    canonicalPath: "c:/fixtures/exact.mkv.part",
  });
  const deleting = h.store.removeDownload(id);
  await Promise.resolve();
  assert.equal(h.writers.get(id)?.aborted, true);
  assert.deepEqual(h.removed, []);
  assert.equal(h.store.downloadsSnapshot().length, 1);
  const aborted = new Error("Canceled");
  aborted.name = "AbortError";
  h.writers.get(id)!.reject(aborted);
  await deleting;
  assert.deepEqual(h.removed, ["C:/fixtures/exact.mkv.part"]);
  assert.deepEqual(h.store.downloadsSnapshot(), []);
});

test("shared paths and directories are never deleted through one download record", async () => {
  const h = harness([item("one"), item("two", { path: "C:/fixtures/alias.mkv" })]);
  h.files.set("C:/fixtures/alias.mkv", { isFile: true, canonicalPath: "c:/fixtures/one.mkv" });
  await assert.rejects(async () => h.store.removeDownload("one"), /another download|shared/i);
  assert.deepEqual(h.removed, []);
  const directory = harness([item("folder")]);
  directory.files.set("C:/fixtures/folder.mkv", {
    isFile: false,
    canonicalPath: "c:/fixtures/folder.mkv",
  });
  await assert.rejects(
    async () => directory.store.removeDownload("folder"),
    /regular file|folder/i,
  );
  assert.deepEqual(directory.removed, []);
});

test("player-owned file deletion is rejected without dropping its record", async () => {
  const h = harness([item("playing")]);
  await assert.rejects(
    () =>
      h.store.removeDownload("playing", {
        protectedPaths: () => ["C:/fixtures/playing.mkv"],
      }),
    /player|in use/i,
  );
  assert.equal(h.store.downloadsSnapshot().length, 1);
  assert.deepEqual(h.removed, []);
});

test("a PDF print receipt never claims a file or deletes its nominal output path", async () => {
  const h = harness([item("print", { kind: "ebook", format: "pdf" })]);
  await assert.rejects(() => h.store.revealDownload("print"), /print|file/i);
  await h.store.removeDownload("print");
  assert.deepEqual(h.removed, []);
  assert.deepEqual(h.store.downloadsSnapshot(), []);
});

test("PDF record removal must be durable before reporting success and can be retried", async () => {
  const h = harness([item("print", { kind: "ebook", format: "pdf" })]);
  h.storage.failWrites = true;
  const failed = await h.store.runDownloadBatch(["print"], "delete");
  assert.deepEqual(failed.succeeded, []);
  assert.equal(failed.failed[0]?.id, "print");
  assert.match(failed.failed[0]?.error ?? "", /record.*could not|could not.*record/i);
  assert.deepEqual(h.removed, []);
  assert.equal(h.store.downloadsSnapshot()[0]?.id, "print");
  assert.equal(h.persisted()[0]?.id, "print");
  assert.equal(h.store.downloadCapabilities("print")?.delete, true);

  h.storage.failWrites = false;
  const retried = await h.store.runDownloadBatch(["print"], "delete");
  assert.deepEqual(retried.succeeded, ["print"]);
  assert.deepEqual(h.store.downloadsSnapshot(), []);
  assert.deepEqual(h.persisted(), []);
  assert.deepEqual(h.removed, []);
});

test("deleted file with an unsaved record reports partial outcome and retains a retryable row", async () => {
  const h = harness([item("deleted"), item("kept")]);
  h.storage.failWrites = true;
  const failed = await h.store.runDownloadBatch(["deleted"], "delete");
  assert.deepEqual(h.removed, ["C:/fixtures/deleted.mkv"]);
  assert.deepEqual(failed.succeeded, []);
  assert.equal(failed.failed[0]?.id, "deleted");
  assert.match(failed.failed[0]?.error ?? "", /files?.*deleted.*record/i);
  assert.deepEqual(
    h.store.downloadsSnapshot().map((d) => d.id),
    ["deleted", "kept"],
  );
  assert.equal(h.store.downloadById("deleted")?.error, failed.failed[0]?.error);
  assert.deepEqual(
    h.persisted().map((d) => d.id),
    ["deleted", "kept"],
  );
  assert.equal(h.store.downloadCapabilities("deleted")?.delete, true);

  h.storage.failWrites = false;
  const retried = await h.store.runDownloadBatch(["deleted"], "delete");
  assert.deepEqual(retried.succeeded, ["deleted"]);
  assert.deepEqual(h.removed, ["C:/fixtures/deleted.mkv"]);
  assert.deepEqual(
    h.store.downloadsSnapshot().map((d) => d.id),
    ["kept"],
  );
  assert.deepEqual(
    h.persisted().map((d) => d.id),
    ["kept"],
  );
});

test("batch deletion reports individual failures and keeps duplicate copies distinct", async () => {
  const h = harness([item("one"), item("two"), item("three")]);
  h.failures.add("C:/fixtures/two.mkv");
  assert.equal(typeof h.store.runDownloadBatch, "function");
  const result = await h.store.runDownloadBatch(["one", "two", "one"], "delete");
  assert.deepEqual(result.succeeded, ["one"]);
  assert.deepEqual(
    result.failed.map((f) => f.id),
    ["two"],
  );
  assert.deepEqual(
    h.store.downloadsSnapshot().map((d) => d.id),
    ["two", "three"],
  );
});

test("hydrated interrupted and managed ebook records do not advertise an unrecoverable retry", () => {
  const h = harness([
    item("old", { status: "downloading" }),
    item("book", { status: "error", kind: "ebook" }),
  ]);
  assert.equal(typeof h.store.downloadCapabilities, "function");
  const old = h.store.downloadCapabilities("old");
  assert.equal(old?.resume, false);
  assert.equal(old?.retry, false);
  assert.equal(h.store.downloadCapabilities("book")?.retry, false);
});

test("pause and resume follow writer state, and batch controls skip ineligible copies", async () => {
  const h = harness([item("saved")]);
  const id = await h.store.enqueueDownload({
    meta: { id: "tt123", type: "movie", name: "Fixture" },
    url: "https://example.test/fixture.mkv",
    destinationPath: "C:/fixtures/active.mkv",
  });
  assert.equal(h.store.downloadCapabilities(id)?.pause, true);
  assert.equal(h.store.downloadCapabilities(id)?.resume, false);
  const firstWriter = h.writers.get(id)!;
  const pausing = h.store.runDownloadBatch([id, "saved"], "pause");
  const aborted = new Error("Canceled");
  aborted.name = "AbortError";
  firstWriter.reject(aborted);
  const result = await pausing;
  assert.deepEqual(result.succeeded, [id]);
  assert.deepEqual(result.skipped, ["saved"]);
  assert.equal(h.store.downloadById(id)?.status, "paused");
  assert.equal(h.store.downloadCapabilities(id)?.resume, true);
  await h.store.runDownloadBatch([id], "resume");
  assert.notEqual(h.writers.get(id), firstWriter);
  assert.equal(h.store.downloadById(id)?.status, "downloading");
  h.writers.get(id)!.resolve();
});

test("a download that completes during cancellation is not reported as canceled", async () => {
  const h = harness();
  const id = await h.store.enqueueDownload({
    meta: { id: "tt123", type: "movie", name: "Fixture" },
    url: "https://example.test/fixture.mkv",
    destinationPath: "C:/fixtures/race.mkv",
  });
  const canceling = h.store.runDownloadBatch([id], "cancel");
  h.writers.get(id)!.resolve();
  const result = await canceling;
  assert.equal(h.store.downloadById(id)?.status, "done");
  assert.deepEqual(result.succeeded, []);
  assert.equal(result.failed[0]?.id, id);
});
