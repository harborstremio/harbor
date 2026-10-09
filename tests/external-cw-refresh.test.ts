import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import type { LibraryItem } from "../src/lib/stremio";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const item = (source: "simkl" | "trakt", id: string): LibraryItem => ({
  _id: id,
  type: "movie",
  name: id,
  external: source,
  removed: false,
  temp: false,
  _ctime: "2026-09-29T12:00:00Z",
  _mtime: "2026-09-29T12:00:00Z",
  state: { lastWatched: "2026-09-29T12:00:00Z", timeOffset: 500, duration: 1000 },
});

function fixture() {
  const timers = new Map<object, { callback: () => void; delay: number }>();
  const listeners: Record<string, () => void> = {};
  const providers = {
    simkl: async (): Promise<LibraryItem[]> => [],
    trakt: async (): Promise<LibraryItem[]> => [],
  };
  const connected = { simkl: true, trakt: true };
  const sessions = { simkl: {}, trakt: {} };
  const detectionBatches: LibraryItem[][] = [];
  const mocks: Record<string, unknown> = {
    react: {},
    "@/lib/simkl/playback": { fetchSimklPlaybackItems: () => providers.simkl() },
    "@/lib/trakt/playback": { fetchTraktPlaybackItems: () => providers.trakt() },
    "@/lib/simkl/session": {
      getSession: () => (connected.simkl ? sessions.simkl : null),
      subscribeSession: (fn: () => void) => {
        listeners.simkl = fn;
      },
    },
    "@/lib/trakt/session": {
      getSession: () => (connected.trakt ? sessions.trakt : null),
      subscribeSession: (fn: () => void) => {
        listeners.trakt = fn;
      },
    },
    "@/lib/stremio": { episodeFromVideoId: () => null },
    "@/lib/anime-detect": {
      detectAnimeForCw: async (items: LibraryItem[]) => {
        detectionBatches.push(items);
      },
    },
  };
  const source = readFileSync(new URL("../src/lib/feed/external-cw.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const api = {} as typeof import("../src/lib/feed/external-cw");
  new Function("require", "exports", "window", "setTimeout", "clearTimeout", output)(
    (id: string) => {
      assert.ok(id in mocks, id);
      return mocks[id];
    },
    api,
    {
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn;
      },
    },
    (callback: () => void, delay: number) => {
      const token = {};
      timers.set(token, { callback, delay });
      return token;
    },
    (token: object) => timers.delete(token),
  );
  return {
    api,
    providers,
    connected,
    sessions,
    listeners,
    timers,
    detectionBatches,
    retry: async () => {
      assert.equal(timers.size, 1);
      const [token, timer] = [...timers][0];
      timers.delete(token);
      timer.callback();
      await settle();
      return timer.delay;
    },
  };
}

test("a partial tracker failure retains its cards and retries without toggling the setting", async () => {
  const h = fixture();
  const old = item("simkl", "old-simkl");
  const fresh = item("trakt", "new-trakt");
  h.providers.simkl = async () => [old];
  await h.api.refreshExternalCw(true);
  h.providers.simkl = async () => {
    throw new Error("Temporary outage");
  };
  h.providers.trakt = async () => [fresh];
  await h.api.refreshExternalCw(true);
  assert.deepEqual(
    new Set(h.api.listExternalCw().map((i) => i._id)),
    new Set([old._id, fresh._id]),
  );
  h.providers.simkl = async () => [item("simkl", "new-simkl")];
  assert.equal(await h.retry(), 1000);
  assert.deepEqual(
    new Set(h.api.listExternalCw().map((i) => i._id)),
    new Set(["new-simkl", fresh._id]),
  );
  assert.equal(h.timers.size, 0);
});

test("changing linked accounts clears the old account even if its replacement is offline", async () => {
  const h = fixture();
  h.providers.simkl = async () => [item("simkl", "old-account")];
  h.providers.trakt = async () => [item("trakt", "keep-trakt")];
  await h.api.refreshExternalCw();
  h.sessions.simkl = {};
  h.providers.simkl = async () => {
    throw new Error("offline");
  };
  h.listeners.simkl();
  assert.deepEqual(
    h.api.listExternalCw().map((i) => i._id),
    ["keep-trakt"],
  );
  await settle();
  assert.deepEqual(
    h.api.listExternalCw().map((i) => i._id),
    ["keep-trakt"],
  );
  h.providers.simkl = async () => [item("simkl", "new-account")];
  await h.retry();
  assert.deepEqual(
    new Set(h.api.listExternalCw().map((i) => i._id)),
    new Set(["keep-trakt", "new-account"]),
  );
});

test("tracker progress enters shared anime detection without waiting for the Stremio library", async () => {
  const h = fixture();
  const trackerItem = item("trakt", "tt101");
  const knownAnime = { ...item("simkl", "tt102"), isAnime: true };
  h.providers.trakt = async () => [trackerItem];
  h.providers.simkl = async () => [knownAnime];
  await h.api.refreshExternalCw(true);
  assert.deepEqual(h.detectionBatches, [[trackerItem]]);
  assert.equal(h.api.listExternalCw().length, 2);
});

test("cold-start partial failures use bounded retries even when the other tracker succeeds empty", async () => {
  const h = fixture();
  let calls = 0;
  h.providers.simkl = async () => {
    calls++;
    throw new Error("Not ready");
  };
  await h.api.refreshExternalCw();
  for (const delay of [1000, 4000, 10000]) assert.equal(await h.retry(), delay);
  assert.equal(calls, 4);
  assert.equal(h.timers.size, 0);
});

test("a response arriving after disabling both sources cannot restore their cards", async () => {
  const h = fixture();
  let resolve!: (items: LibraryItem[]) => void;
  h.providers.simkl = () =>
    new Promise((done) => {
      resolve = done;
    });
  const load = h.api.refreshExternalCw();
  h.api.setExternalCwSources({ simkl: false, trakt: false });
  resolve([item("simkl", "disabled")]);
  await load;
  assert.deepEqual(h.api.listExternalCw(), []);
  assert.equal(h.timers.size, 0);
});

test("a non-forced duplicate refresh shares the active request without discarding it", async () => {
  const h = fixture();
  let resolve!: (items: LibraryItem[]) => void;
  let calls = 0;
  h.providers.simkl = () => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const load = h.api.refreshExternalCw();
  const duplicate = h.api.refreshExternalCw();
  assert.equal(load, duplicate);
  resolve([item("simkl", "new")]);
  await load;
  assert.equal(calls, 1);
  assert.equal(h.api.listExternalCw()[0]._id, "new");
});

test("a successful empty response removes old cards, unlike a failed response", async () => {
  const h = fixture();
  h.providers.simkl = async () => [item("simkl", "old")];
  await h.api.refreshExternalCw();
  h.providers.simkl = async () => [];
  await h.api.refreshExternalCw(true);
  assert.deepEqual(h.api.listExternalCw(), []);
  assert.equal(h.timers.size, 0);
});
