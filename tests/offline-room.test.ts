import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as policy from "../src/lib/download/offline-policy.ts";

const OWNER_A = JSON.stringify(["account-a", "profile-a"]);
const OWNER_B = JSON.stringify(["account-b", "profile-a"]);
const LOCAL = JSON.stringify(["local", "profile-a"]);
const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function fixture(seed?: string, initialOwner = OWNER_A) {
  const storage = new Map<string, string>(seed ? [["harbor.downloads.v1", seed]] : []);
  const files = new Map<string, number>();
  const transfers = new Map<
    string,
    { finish(): void; abort(): void; fail(): void; path: string }
  >();
  const calls: string[] = [];
  let owner = initialOwner,
    ownerChanged = () => {},
    deleteBlocked = false;
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/download/downloads-store.ts", import.meta.url), "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText;
  const mocks: Record<string, unknown> = {
    react: { useSyncExternalStore: (_: unknown, get: () => unknown) => get() },
    "@tauri-apps/api/path": { downloadDir: async () => "/downloads" },
    "@tauri-apps/api/core": { invoke: async () => null },
    "@tauri-apps/plugin-opener": {
      revealItemInDir: async (path: string) => {
        calls.push(`reveal:${path}`);
      },
    },
    "@tauri-apps/plugin-fs": {
      exists: async (path: string) => files.has(path),
      mkdir: async () => {},
      stat: async (path: string) => {
        if (!files.has(path)) throw Error("missing");
        return { isFile: true, size: files.get(path) };
      },
      remove: async (path: string) => {
        if (deleteBlocked) throw Error("locked");
        files.delete(path);
        calls.push(`delete:${path}`);
      },
    },
    "@/lib/platform": { isWindowsDesktop: () => false },
    "./owner": {
      downloadOwner: () => owner,
      subscribeDownloadOwner: (listener: () => void) => {
        ownerChanged = listener;
      },
    },
    "./offline-policy": policy,
    "./filename": {
      sanitizeName: (name: string) => name,
      buildDefaultFilename: (meta: { id: string }) => `${meta.id}.mp4`,
    },
    "@/lib/torrent/local-engine": { localEngineStreamRef: () => null },
    "./video-download": {
      startDownload: (id: string, _url: string, path: string, progress: (p: unknown) => void) => {
        calls.push(`start:${id}`);
        let resolve!: () => void, reject!: (error: Error) => void;
        const promise = new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        });
        const task = {
          path,
          finish: () => {
            files.delete(`${path}.part`);
            files.set(path, 1_048_576);
            progress({ receivedBytes: 1_048_576, totalBytes: 1_048_576, ratio: 1 });
            resolve();
          },
          fail: () => {
            files.set(`${path}.part`, 262_144);
            reject(Error("fixture interrupted"));
          },
          abort: () => {
            calls.push(`abort:${id}`);
            files.set(`${path}.part`, 262_144);
            const error = new Error("paused");
            error.name = "AbortError";
            reject(error);
          },
        };
        transfers.set(id, task);
        return { promise, abort: task.abort };
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "localStorage", "navigator", code)(
    (name: string) => {
      assert.ok(name in mocks, name);
      return mocks[name];
    },
    module,
    module.exports,
    {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    { onLine: true },
  );
  return {
    api: module.exports as typeof import("../src/lib/download/downloads-store.ts"),
    storage,
    files,
    transfers,
    calls,
    owner: (next: string) => {
      owner = next;
      ownerChanged();
    },
    blockDelete: () => {
      deleteBlocked = true;
    },
    enqueue: (id: string, headers?: Record<string, string>) =>
      (module.exports as any).enqueueDownload({
        meta: { id, name: id, type: "movie" },
        url: `https://synthetic.invalid/${id}.mp4`,
        headers,
      }),
  };
}

test("queue limits two active transfers, persists queued intent and starts the next after completion", async () => {
  const f = fixture();
  const a = await f.enqueue("a"),
    b = await f.enqueue("b"),
    c = await f.enqueue("c");
  assert.equal(f.transfers.size, 2);
  assert.equal(f.api.downloadsSnapshot().find((d) => d.id === c)?.status, "queued");
  f.transfers.get(a)!.finish();
  await tick();
  assert.equal(f.transfers.size, 3);
  assert.equal(f.api.downloadsSnapshot().find((d) => d.id === c)?.status, "downloading");
  f.transfers.get(b)!.abort();
  f.transfers.get(c)!.abort();
  await tick();
});

test("restart preserves paused work, interrupts active work and makes no automatic provider request", async () => {
  const f = fixture();
  const id = await f.enqueue("a");
  const running = f.storage.get("harbor.downloads.v1")!;
  const relaunched = fixture(running);
  assert.equal(relaunched.api.downloadsSnapshot()[0].status, "interrupted");
  assert.equal(relaunched.calls.length, 0);
  await relaunched.api.resumeDownload(id);
  assert.equal(relaunched.calls.length, 1);
  relaunched.api.pauseDownload(id);
  await tick();
  const again = fixture(relaunched.storage.get("harbor.downloads.v1"));
  assert.equal(again.api.downloadsSnapshot()[0].status, "paused");
  f.api.pauseDownload(id);
  await tick();
});

test("headers are never persisted and retries requiring missing headers tell the user to reselect", async () => {
  const f = fixture();
  const id = await f.enqueue("a", { Authorization: "synthetic-secret" });
  assert.ok(!f.storage.get("harbor.downloads.v1")!.includes("synthetic-secret"));
  const again = fixture(f.storage.get("harbor.downloads.v1"));
  await again.api.resumeDownload(id);
  assert.equal(again.calls.length, 0);
  assert.match(again.api.downloadsSnapshot()[0].error!, /Select the source again/);
  f.api.pauseDownload(id);
  await tick();
});

test("owner switch pauses transfers and prevents old-owner lookup, reveal, deletion and retry", async () => {
  const f = fixture();
  const id = await f.enqueue("a");
  f.owner(OWNER_B);
  await tick();
  assert.equal(f.api.downloadsSnapshot().length, 0);
  assert.equal(f.api.activeDownloadFor("a"), null);
  const before = f.calls.length;
  await f.api.resumeDownload(id);
  await f.api.revealDownload(id);
  await f.api.removeDownload(id);
  assert.equal(f.calls.length, before);
  f.owner(OWNER_A);
  assert.equal(f.api.downloadsSnapshot()[0].status, "paused");
  assert.ok(f.files.has(`${f.transfers.get(id)!.path}.part`));
});

test("legacy ownership requires an explicit local-profile claim and never assigns to signed-in accounts", async () => {
  const f = fixture();
  const id = await f.enqueue("a");
  f.api.pauseDownload(id);
  await tick();
  const raw = JSON.parse(f.storage.get("harbor.downloads.v1")!);
  delete raw[0].owner;
  const legacy = fixture(JSON.stringify(raw));
  assert.equal(legacy.api.downloadsSnapshot().length, 0);
  legacy.api.claimLegacyDownloads();
  assert.equal(legacy.api.downloadsSnapshot().length, 0);
  legacy.owner(LOCAL);
  legacy.api.claimLegacyDownloads();
  assert.equal(legacy.api.downloadsSnapshot()[0].id, id);
  assert.equal(legacy.api.unclaimedDownloadCount(), 0);
});

test("delete waits for the writer and removes partial plus validator; deletion failures remain visible", async () => {
  const f = fixture();
  const id = await f.enqueue("a");
  const path = f.transfers.get(id)!.path;
  f.files.set(`${path}.part.meta.json`, 100);
  await f.api.removeDownload(id);
  assert.equal(f.files.size, 0);
  assert.equal(f.api.downloadsSnapshot().length, 0);
  assert.ok(f.calls.indexOf(`abort:${id}`) < f.calls.indexOf(`delete:${path}.part`));
  const other = await f.enqueue("b");
  f.transfers.get(other)!.finish();
  await tick();
  f.blockDelete();
  await f.api.removeDownload(other);
  assert.equal(f.api.downloadsSnapshot()[0].status, "error");
  assert.match(f.api.downloadsSnapshot()[0].error!, /Could not delete/);
});

test("saved playback lookup uses local files without a provider request and detects missing or changed files", async () => {
  const f = fixture();
  const id = await f.enqueue("a");
  f.transfers.get(id)!.finish();
  await tick();
  const calls = f.calls.length;
  assert.equal((await f.api.completedDownloadFor("a", null, null))?.id, id);
  assert.equal(f.calls.length, calls);
  f.files.set(f.transfers.get(id)!.path, 100);
  await f.api.verifyDownloadFiles();
  assert.equal(f.api.downloadsSnapshot()[0].status, "error");
  assert.match(f.api.downloadsSnapshot()[0].error!, /size changed/);
});

test("offline policy rejects manifests, non-HTTP sources and embedded credentials", () => {
  for (const source of [
    "https://synthetic.invalid/a.m3u8?signature=x",
    "https://synthetic.invalid/a.mpd",
    "file:///private",
    "https://u:p@synthetic.invalid/a.mp4",
  ])
    assert.ok(policy.directDownloadError(source));
  assert.equal(policy.directDownloadError("https://synthetic.invalid/opaque?signature=x"), null);
});
