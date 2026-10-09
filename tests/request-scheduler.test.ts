import assert from "node:assert/strict";
import test from "node:test";
import { createRequestScheduler } from "../src/lib/request-scheduler.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("caps concurrency and coalesces duplicate keys", async () => {
  const scheduler = createRequestScheduler({ concurrency: 2 });
  const firstGate = deferred<string>();
  const secondGate = deferred<string>();

  const first = scheduler.schedule("first", () => firstGate.promise);
  const duplicate = scheduler.schedule("first", () => Promise.resolve("wrong"));
  const second = scheduler.schedule("second", () => secondGate.promise);
  const third = scheduler.schedule("third", () => Promise.resolve("third"));

  assert.equal(first, duplicate);
  assert.deepEqual(scheduler.snapshot(), { active: 2, queued: 1, inFlight: 3 });

  firstGate.resolve("first");
  assert.equal(await first, "first");
  assert.equal(await third, "third");
  secondGate.resolve("second");
  assert.equal(await second, "second");
  assert.deepEqual(scheduler.snapshot(), { active: 0, queued: 0, inFlight: 0 });
});

test("releases capacity after a rejected request", async () => {
  const scheduler = createRequestScheduler({ concurrency: 1 });
  const gate = deferred<string>();
  let secondStarted = false;

  const first = scheduler.schedule("first", () => gate.promise);
  const second = scheduler.schedule("second", async () => {
    secondStarted = true;
    return "second";
  });

  gate.reject(new Error("expected failure"));
  await assert.rejects(first, /expected failure/);
  assert.equal(await second, "second");
  assert.equal(secondStarted, true);
});

test("pauseFor delays queued work", async () => {
  const scheduler = createRequestScheduler({ concurrency: 1 });
  let started = false;

  scheduler.pauseFor(20);
  const result = scheduler.schedule("paused", async () => {
    started = true;
    return "ready";
  });

  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(started, false);
  assert.equal(await result, "ready");
});

test("settled keys can run again without retained in-flight entries", async () => {
  const scheduler = createRequestScheduler({ concurrency: 1 });
  let runs = 0;
  const run = () => scheduler.schedule("repeat", async () => ++runs);

  assert.equal(await run(), 1);
  assert.deepEqual(scheduler.snapshot(), { active: 0, queued: 0, inFlight: 0 });
  assert.equal(await run(), 2);
  assert.deepEqual(scheduler.snapshot(), { active: 0, queued: 0, inFlight: 0 });
});
