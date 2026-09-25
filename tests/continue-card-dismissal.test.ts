import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function harness() {
  const data = new Map<string, string>();
  const writes: any[] = [];
  let failKey = "";
  let online = true;
  let heldAuth = "";
  let releaseHeld: (() => void) | undefined;
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem(key: string, value: string) {
      if (key === failKey) throw new Error("Storage unavailable");
      data.set(key, value);
    },
    removeItem: (key: string) => data.delete(key),
  };
  const cache = new Map<string, any>();
  const load = (name: string): any => {
    const file = name.replace(/^@\/lib\//, "").replace(/^\.\//, "");
    if (cache.has(file)) return cache.get(file);
    if (file === "react") return { useSyncExternalStore() {} };
    if (file === "stremio")
      return {
        episodeFromVideoId: (id?: string) => {
          const match = id?.match(/:(\d+):(\d+)$/);
          return match ? { season: +match[1], episode: +match[2] } : null;
        },
        libraryPut: async (auth: string, item: any) => {
          if (auth === heldAuth) {
            heldAuth = "";
            await new Promise<void>((resolve) => {
              releaseHeld = resolve;
            });
          }
          if (!online) throw new Error("Offline");
          writes.push({ auth, item });
        },
        libraryGetOneStrict: async () => null,
      };
    if (file === "storage-recovery")
      return {
        setItemWithRecovery: (key: string, value: string) => {
          storage.setItem(key, value);
          return true;
        },
        persistCritical() {},
      };
    const mod = { exports: {} };
    cache.set(file, mod.exports);
    const output = ts.transpileModule(
      readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText;
    new Function("require", "module", "exports", "localStorage", "window", output)(
      load,
      mod,
      mod.exports,
      storage,
      undefined,
    );
    return mod.exports;
  };
  return {
    data,
    writes,
    load,
    set failure(key: string) {
      failKey = key;
    },
    set online(value: boolean) {
      online = value;
    },
    set holdAuth(value: string) {
      heldAuth = value;
    },
    release() {
      releaseHeld?.();
    },
  };
}

const entry = () => ({
  _id: "older-b",
  type: "series",
  name: "Older B",
  removed: false,
  temp: false,
  state: { video_id: "older-b:2:3", season: 2, episode: 3, timeOffset: 90000, duration: 600000 },
  _mtime: "2026-09-14T00:00:00Z",
});

test("acknowledged dismissal preserves other episodes/history and survives a fresh catalog rebuild", async () => {
  const h = harness();
  const resume = {
    "older-b|s2e3": { ms: 90000, t: 2 },
    "older-b|s2e4": { ms: 22000, t: 3 },
    newestA: { ms: 30000, t: 4 },
  };
  h.data.set("harbor.resume", JSON.stringify(resume));
  h.data.set("harbor.playback-history.v1", "unchanged-actual-playback");
  const cw = h.load("cw-dismiss");
  const result = await cw.dismissCw(entry(), "fixture-auth", { acknowledged: true });
  assert.deepEqual(result, { sync: "synced" });
  assert.equal(cw.isCwDismissed(entry()), true);
  assert.deepEqual(JSON.parse(h.data.get("harbor.resume")!), {
    "older-b|s2e4": resume["older-b|s2e4"],
    newestA: resume.newestA,
  });
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].item.state.timeOffset, 0);
  assert.equal(h.writes[0].item.removed, false);
  assert.equal(h.data.get("harbor.playback-history.v1"), "unchanged-actual-playback");
  const fresh = harness();
  h.data.forEach((value, key) => fresh.data.set(key, value));
  assert.equal(fresh.load("cw-dismiss").isCwDismissed(entry()), true);
});

test("external dismissal keeps official local resume clearing without writing to a provider", async () => {
  const h = harness();
  h.data.set("harbor.resume", '{"older-b|s2e3":{"ms":90000,"t":2}}');
  const result = await h
    .load("cw-dismiss")
    .dismissCw({ ...entry(), external: "trakt" }, "fixture-auth", { acknowledged: true });
  assert.deepEqual(result, { sync: "not-required" });
  assert.equal(h.writes.length, 0);
  assert.deepEqual(JSON.parse(h.data.get("harbor.resume")!), {});
});

test("acknowledged dismissal persists official progress tombstones and newer progress restores the card", async () => {
  const h = harness();
  await h.load("cw-dismiss").dismissCw(entry(), null, { acknowledged: true });
  const tombstone = JSON.parse(h.data.get("harbor.cw.dismissed.v1")!)["older-b"];
  assert.equal(tombstone.v, "older-b:2:3");
  assert.equal(tombstone.s, 2);
  assert.equal(tombstone.e, 3);
  assert.equal(tombstone.p, 0.15);
  const fresh = harness();
  h.data.forEach((value, key) => fresh.data.set(key, value));
  const cw = fresh.load("cw-dismiss");
  assert.equal(cw.isCwDismissed(entry()), true);
  assert.equal(
    cw.isCwDismissed({ ...entry(), state: { ...entry().state, timeOffset: 180000 } }),
    false,
  );
});

test("removing older B preserves the canonical global last actual playback A", async () => {
  const h = harness();
  const history = h.load("playback-history");
  const actor = history.capturePlaybackActor();
  const base = { actor, positionMs: 90000, durationMs: 600000, completed: false };
  assert.equal(
    history.recordActualPlayback({
      ...base,
      id: "session-b",
      playedAt: Date.now() - 1000,
      src: {
        url: "file:///fixture-b.mp4",
        meta: { id: "older-b", type: "series", name: "Older B" },
        episode: { season: 2, episode: 3 },
      },
    }),
    true,
  );
  assert.equal(
    history.recordActualPlayback({
      ...base,
      id: "session-a",
      playedAt: Date.now(),
      src: {
        url: "file:///fixture-a.mp4",
        meta: { id: "newest-a", type: "movie", name: "Newest A" },
      },
    }),
    true,
  );
  assert.equal(history.readLastActualPlayback()?.id, "session-a");
  await h.load("cw-dismiss").dismissCw(entry(), "fixture-auth", { acknowledged: true });
  assert.equal(history.readLastActualPlayback()?.id, "session-a");
  assert.equal(history.readLastActualPlayback()?.positionMs, 90000);
  assert.equal(history.readLastActualPlayback()?.src.meta.id, "newest-a");
});

test("failed dismissal persistence does not publish a memory-only tombstone or clear resume", async () => {
  const h = harness();
  h.data.set("harbor.resume", "original-resume");
  h.failure = "harbor.cw.dismissed.v1";
  const cw = h.load("cw-dismiss");
  await assert.rejects(
    async () => cw.dismissCw(entry(), "fixture-auth", { acknowledged: true }),
    /storage/i,
  );
  assert.equal(cw.isCwDismissed(entry()), false);
  assert.equal(h.data.get("harbor.resume"), "original-resume");
  assert.equal(h.writes.length, 0);
});

test("offline removal acknowledges durable queued synchronization, not a remote success", async () => {
  const h = harness();
  h.online = false;
  const result = await h
    .load("cw-dismiss")
    .dismissCw(entry(), "fixture-auth", { acknowledged: true });
  assert.deepEqual(result, { sync: "queued" });
  const queued = JSON.parse(h.data.get("harbor.stremio.write-queue.v1")!);
  assert.equal(queued[0].item._id, "older-b");
  assert.equal(queued[0].item.state.timeOffset, 0);
});

test("a failed queue write reports partial dismissal instead of claiming pending synchronization is durable", async () => {
  const h = harness();
  h.online = false;
  h.failure = "harbor.stremio.write-queue.v1";
  await assert.rejects(
    async () => h.load("cw-dismiss").dismissCw(entry(), "fixture-auth", { acknowledged: true }),
    /sync/i,
  );
});

test("local and manual dismissal failures leave their previous canonical and cached entries intact", () => {
  const h = harness();
  const local = h.load("local-cw");
  local.saveLocalCw({
    id: "older-b",
    type: "movie",
    name: "Older B",
    positionMs: 90000,
    durationMs: 600000,
    t: 2,
  });
  const previous = h.data.get("harbor.localcw.v1");
  h.failure = "harbor.localcw.v1";
  assert.throws(() => local.clearLocalCw("older-b", { acknowledged: true }), /storage/i);
  assert.equal(local.localCwEntry("older-b")?.id, "older-b");
  assert.equal(h.data.get("harbor.localcw.v1"), previous);
  h.failure = "harbor.manualwatched.dismissed.v1";
  const manual = h.load("manual-watched");
  assert.throws(() => manual.dismissManualWatched("older-b", { acknowledged: true }), /storage/i);
  assert.equal(manual.isManualWatchedDismissed("older-b"), false);
});

test("a previous account's delayed queue write cannot replace the new account's pending dismissal for the same title", async () => {
  const h = harness();
  h.online = false;
  h.holdAuth = "fixture-account-a";
  const queue = h.load("stremio-write-queue");
  const old = queue.cloudLibraryPut("fixture-account-a", entry(), { acknowledged: true });
  await queue.cloudLibraryPut(
    "fixture-account-b",
    { ...entry(), state: { ...entry().state, timeOffset: 0, watched: "b" } },
    { acknowledged: true },
  );
  h.release();
  await old;
  const pending = JSON.parse(h.data.get("harbor.stremio.write-queue.v1")!);
  assert.equal(pending.length, 2);
  assert.equal(
    pending.find((value: any) => value.authKey === "fixture-account-b").item.state.timeOffset,
    0,
  );
  assert.equal(queue.queuedWatched("older-b", "fixture-account-b")?.watched, "b");
  assert.equal(queue.queuedWatched("older-b", "fixture-account-c"), undefined);
});

test("an old successful request cannot delete a newer queued record with the same timestamp", async () => {
  const h = harness();
  const queue = h.load("stremio-write-queue");
  h.online = false;
  await queue.cloudLibraryPut("fixture-auth", entry());
  h.holdAuth = "fixture-auth";
  const old = queue.cloudLibraryPut("fixture-auth", entry(), { acknowledged: true });
  await queue.cloudLibraryPut(
    "fixture-auth",
    { ...entry(), state: { ...entry().state, watched: "newer-state" } },
    { acknowledged: true },
  );
  h.online = true;
  h.release();
  await old;
  assert.equal(queue.queuedWatched("older-b", "fixture-auth")?.watched, "newer-state");
  assert.equal(JSON.parse(h.data.get("harbor.stremio.write-queue.v1")!).length, 1);
});

test("an old failure cannot resurrect a queue entry after the newer request completed", async () => {
  const h = harness();
  const queue = h.load("stremio-write-queue");
  h.holdAuth = "fixture-auth";
  const old = queue.cloudLibraryPut("fixture-auth", entry(), { acknowledged: true });
  await queue.cloudLibraryPut(
    "fixture-auth",
    { ...entry(), state: { ...entry().state, watched: "newer-state" } },
    { acknowledged: true },
  );
  h.online = false;
  h.release();
  await assert.rejects(old, /newer/i);
  assert.equal(queue.queuedWatched("older-b", "fixture-auth"), undefined);
});
