import assert from "node:assert/strict";
import { test } from "node:test";
import { createDownloadCompletionTracker, watchDownloadCompletions, DOWNLOAD_COMPLETION_PREFIX, type DownloadCompletionKind, type DownloadCompletionRecord } from "../src/lib/games/download-completions.ts";

const record = (status: string, updatedAt = 1, id = "one", profile = "alice"): DownloadCompletionRecord => ({ id, profile, name: "Game archive.zip", status, updatedAt, game: { id: "steam:10", name: "The game" } });
const storage = () => {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("completed history and first complete events are silent, observed finishes notify once", () => {
  const seen = createDownloadCompletionTracker("alice", storage());
  seen.seed("http", [record("complete")]);
  assert.equal(seen.observe("http", record("complete", 2)), null);
  assert.equal(seen.observe("torrent", record("complete", 2)), null);
  seen.seed("http", [record("downloading", 1, "active")]);
  const finish = record("complete", 2, "active");
  assert.equal(seen.observe("http", finish), finish);
  assert.equal(seen.observe("http", finish), null);
  seen.observe("http", record("checking", 3, "active"));
  assert.equal(seen.observe("http", record("complete", 4, "active")), null);
});

test("deduplication survives reload, separates profiles and engines, and preserves identity", () => {
  const saved = storage(), one = createDownloadCompletionTracker("alice", saved);
  one.observe("http", record("downloading"));
  assert.ok(one.observe("http", record("complete", 2)));
  const again = createDownloadCompletionTracker("alice", saved);
  again.seed("http", [record("downloading", 3)]);
  assert.equal(again.observe("http", record("complete", 4)), null);
  again.observe("torrent", record("downloading"));
  const torrent = record("complete", 2);
  assert.equal(again.observe("torrent", torrent)?.game, torrent.game);
  const bob = createDownloadCompletionTracker("bob", saved);
  bob.observe("http", record("downloading", 1, "one", "bob"));
  assert.ok(bob.observe("http", record("complete", 2, "one", "bob")));
  assert.equal(saved.values.size, 2);
  assert.ok(!saved.getItem(DOWNLOAD_COMPLETION_PREFIX + "alice")?.includes("archive.zip"));
});

test("foreign profiles, stale progress, and list refreshes cannot invent completions", () => {
  const seen = createDownloadCompletionTracker("alice", storage());
  seen.seed("http", [record("downloading", 10)]);
  assert.equal(seen.observe("http", record("complete", 11, "one", "bob")), null);
  assert.equal(seen.observe("http", record("complete", 9)), null);
  seen.seed("http", [record("complete", 12)]);
  assert.ok(seen.observe("http", record("complete", 12)));
  seen.seed("http", [record("downloading", 13)]);
  assert.equal(seen.observe("http", record("complete", 14)), null);
});

test("invalid cache and unavailable persistence retain safe session behavior", () => {
  for (const saved of [{ getItem: () => "not json", setItem: () => {} }, { getItem: () => { throw Error("disabled"); }, setItem: () => { throw Error("full"); } }]) {
    const seen = createDownloadCompletionTracker("alice", saved);
    seen.observe("http", record("downloading"));
    assert.ok(seen.observe("http", record("complete", 2)));
    assert.equal(seen.observe("http", record("complete", 2)), null);
    assert.equal(seen.observe("http", { ...record("complete", 3), updatedAt: NaN }), null);
  }
});

test("same-millisecond completion is real; checking, pause, failure and cancellation are not", () => {
  const seen = createDownloadCompletionTracker("alice", storage());
  for (const status of ["queued", "checking", "downloading", "paused", "failed", "canceling", "canceled"]) assert.equal(seen.observe("http", record(status)), null);
  assert.ok(seen.observe("http", record("complete")));
});

test("a thousand completed baseline records use bounded storage work; progress is storage-free", () => {
  const saved = storage(); let reads = 0, writes = 0;
  const seen = createDownloadCompletionTracker("alice", {
    getItem: key => { reads++; return saved.getItem(key); },
    setItem: (key, value) => { writes++; saved.setItem(key, value); },
  });
  seen.seed("http", Array.from({ length: 1_000 }, (_, index) => record("complete", 1, `old-${index}`)));
  assert.equal(reads, 2); assert.equal(writes, 1);
  for (let index = 0; index < 1_000; index++) seen.observe("torrent", record("downloading", index, "active"));
  assert.equal(reads, 2); assert.equal(writes, 1);
  assert.ok(seen.observe("torrent", record("complete", 1_000, "active")));
  assert.equal(reads, 3); assert.equal(writes, 2);
  for (let index = 0; index < 100; index++) seen.observe("torrent", record("complete", 1_001 + index, "active"));
  assert.equal(reads, 3); assert.equal(writes, 2);
});

test("listeners register before baselines and retain transitions during an outstanding list", async () => {
  const listeners = new Map<DownloadCompletionKind, (item: DownloadCompletionRecord) => void>();
  const resolveLists = new Map<DownloadCompletionKind, (items: DownloadCompletionRecord[]) => void>();
  const notices: string[] = [];
  const stop = watchDownloadCompletions("alice", {
    listen: async (kind, callback) => { listeners.set(kind, callback); return () => { listeners.delete(kind); }; },
    list: kind => { assert.ok(listeners.has(kind)); return new Promise(resolve => { resolveLists.set(kind, resolve); }); },
  }, storage(), async (kind, item) => { notices.push(`${kind}:${item.id}`); });
  await tick();
  listeners.get("http")!(record("downloading", 1));
  listeners.get("http")!(record("complete", 2));
  resolveLists.get("http")!([record("downloading", 1)]);
  resolveLists.get("torrent")!([record("complete", 1)]);
  await tick();
  listeners.get("http")!(record("complete", 3));
  listeners.get("torrent")!(record("complete", 3));
  assert.deepEqual(notices, ["http:one"]);
  const old = listeners.get("http")!;
  stop(); old(record("downloading", 1, "late")); old(record("complete", 2, "late"));
  assert.equal(listeners.size, 0); assert.equal(notices.length, 1);
});

test("cleanup releases late listeners and failed adapters cannot repeatedly notify", async () => {
  let resolveListen!: (stop: () => void) => void, disposed = 0;
  const stop = watchDownloadCompletions("alice", { listen: kind => kind === "http" ? new Promise(resolve => { resolveListen = resolve; }) : Promise.reject(Error("not available")), list: async () => [] }, storage(), async () => {});
  stop(); resolveListen(() => { disposed++; }); await tick(); assert.equal(disposed, 1);
  let receive!: (item: DownloadCompletionRecord) => void, attempts = 0;
  const cleanup = watchDownloadCompletions("alice", { listen: async (kind, callback) => { if (kind === "http") receive = callback; return () => {}; }, list: async () => [] }, storage(), async () => { attempts++; throw Error("OS unavailable"); });
  await tick(); receive(record("downloading")); receive(record("complete", 2)); receive(record("complete", 3)); await tick();
  assert.equal(attempts, 1); cleanup();
});
