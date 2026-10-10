import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prepareSportsChannels } from "../src/lib/sports/channel-index.ts";
import { parseM3uAsync } from "../src/lib/iptv/parse-m3u-async.ts";
import { parseM3u } from "../src/lib/iptv/m3u.ts";

const playlist =
  '#EXTM3U\n#EXTINF:-1 group-title="Sports",ESPN\nhttps://example.com/one.m3u8\n#EXTINF:-1,UFC\nhttps://example.com/two.m3u8';

class SilentWorker {
  static instances: SilentWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    SilentWorker.instances.push(this);
  }
  postMessage(_data: unknown) {}
  terminate() {
    this.terminated = true;
  }
}

function installWorker(t: TestContext) {
  SilentWorker.instances = [];
  for (const [key, value] of Object.entries({
    Worker: SilentWorker,
    scheduler: { yield: () => Promise.resolve() },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
}

test("a silent sports worker times out, releases handlers and completes through the yielding fallback", async (t) => {
  installWorker(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const channels = parseM3u(playlist, "worker-timeout");
  const task = prepareSportsChannels(channels, new AbortController().signal, () => {});
  const worker = SilentWorker.instances[0];
  t.mock.timers.tick(15_000);
  const result = await task;
  assert.equal(result.scanned, 2);
  assert.equal(worker.terminated, true);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onmessageerror, null);
  assert.equal(worker.onerror, null);
});

test("aborting a sports index terminates its pending worker without publishing a final index", async (t) => {
  installWorker(t);
  const controller = new AbortController();
  let publications = 0;
  const task = prepareSportsChannels(
    parseM3u(playlist, "worker-abort"),
    controller.signal,
    () => publications++,
  );
  controller.abort();
  await assert.rejects(task, { name: "AbortError" });
  assert.equal(publications, 0);
  assert.equal(SilentWorker.instances[0].terminated, true);
  assert.equal(SilentWorker.instances[0].onmessage, null);
});

test("a stalled M3U worker falls back after partial output without duplicating channels", async (t) => {
  installWorker(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const expected = parseM3u(playlist, "m3u-timeout");
  const task = parseM3uAsync(playlist, "m3u-timeout");
  const worker = SilentWorker.instances[0];
  worker.onmessage?.({ data: { channels: expected.slice(0, 1), done: false } });
  t.mock.timers.tick(15_000);
  assert.deepEqual(await task, expected);
  assert.equal(worker.terminated, true);
  assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null);
});

test("M3U cancellation rejects and cleans up instead of starting fallback parsing", async (t) => {
  installWorker(t);
  const controller = new AbortController();
  let publications = 0;
  const task = parseM3uAsync(playlist, "m3u-abort", () => publications++, controller.signal);
  controller.abort();
  await assert.rejects(task, { name: "AbortError" });
  assert.equal(publications, 0);
  assert.equal(SilentWorker.instances[0].terminated, true);
  assert.equal(SilentWorker.instances[0].onmessageerror, null);
});

test("unreadable worker responses trigger a cleaned-up fallback for both pipelines", async (t) => {
  installWorker(t);
  const indexTask = prepareSportsChannels(
    parseM3u(playlist, "index-message-error"),
    new AbortController().signal,
    () => {},
  );
  SilentWorker.instances[0].onmessageerror?.();
  assert.equal((await indexTask).scanned, 2);
  const parseTask = parseM3uAsync(playlist, "parser-message-error");
  SilentWorker.instances[1].onmessageerror?.();
  assert.deepEqual(await parseTask, parseM3u(playlist, "parser-message-error"));
  assert.equal(
    SilentWorker.instances.every(
      (worker) => worker.terminated && worker.onmessage === null && worker.onmessageerror === null,
    ),
    true,
  );
});
