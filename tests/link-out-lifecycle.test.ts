import assert from "node:assert/strict";
import test from "node:test";
import { createLinkOutStore, settleLinkOutOpen } from "../src/lib/social/link-out.ts";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("same-URL reopen receives a new generation", () => {
  const store = createLinkOutStore();
  const first = store.open("https://example.com");
  store.close();
  const second = store.open("https://example.com");
  assert.ok(first && second);
  assert.notEqual(first.generation, second.generation);
  assert.equal(store.isCurrent(first), false);
  assert.equal(store.isCurrent(second), true);
});

test("stale opener resolution or rejection cannot mutate the reopened journey", async () => {
  for (const outcome of ["resolve", "reject"] as const) {
    const store = createLinkOutStore();
    const first = store.open("https://example.com");
    assert.ok(first);
    const work = deferred<void>();
    const calls: string[] = [];
    const settling = settleLinkOutOpen(store.isCurrent, first, work.promise, {
      onSuccess: () => calls.push("success"),
      onError: () => calls.push("error"),
      onSettled: () => calls.push("settled"),
    });
    store.close();
    store.open("https://example.com");
    if (outcome === "resolve") work.resolve();
    else work.reject(new Error("unavailable"));
    await settling;
    assert.deepEqual(calls, [], outcome);
  }
});

test("current opener runs the expected success and error lifecycles", async () => {
  {
    const store = createLinkOutStore();
    const journey = store.open("https://example.com");
    assert.ok(journey);
    const calls: string[] = [];
    await settleLinkOutOpen(store.isCurrent, journey, Promise.resolve(), {
      onSuccess: () => calls.push("success"),
      onError: () => calls.push("error"),
      onSettled: () => calls.push("settled"),
    });
    assert.deepEqual(calls, ["settled", "success"]);
  }
  {
    const store = createLinkOutStore();
    const journey = store.open("https://example.com");
    assert.ok(journey);
    const calls: string[] = [];
    await settleLinkOutOpen(store.isCurrent, journey, Promise.reject(new Error("unavailable")), {
      onSuccess: () => calls.push("success"),
      onError: () => calls.push("error"),
      onSettled: () => calls.push("settled"),
    });
    assert.deepEqual(calls, ["error", "settled"]);
  }
});
