// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { coalesceKeyed } from "../src/lib/keyed-inflight.ts";

test("coalesces concurrent loads and removes the entry after settlement", async () => {
  const inflight = new Map<string, Promise<number>>();
  let calls = 0;
  let release: (() => void) | undefined;
  const loader = () => {
    calls += 1;
    return new Promise<number>((resolve) => {
      release = () => resolve(42);
    });
  };

  const first = coalesceKeyed(inflight, "anime:kitsu:1", loader);
  const second = coalesceKeyed(inflight, "anime:kitsu:1", loader);
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  assert.equal(inflight.size, 1);

  release?.();
  assert.deepEqual(await Promise.all([first, second]), [42, 42]);
  assert.equal(inflight.size, 0);

  assert.equal(
    await coalesceKeyed(inflight, "anime:kitsu:1", async () => {
      calls += 1;
      return 43;
    }),
    43,
  );
  assert.equal(calls, 2);
});

test("removes a failed load so a later retry can start", async () => {
  const inflight = new Map<string, Promise<number>>();
  await assert.rejects(
    coalesceKeyed(inflight, "anime:kitsu:2", async () => {
      throw new Error("temporary failure");
    }),
    /temporary failure/,
  );
  assert.equal(inflight.size, 0);
});
