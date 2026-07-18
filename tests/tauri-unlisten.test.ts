// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { isStaleTauriListenerError, makeSafeTauriUnlisten } from "../src/lib/tauri-unlisten.ts";

test("safe Tauri unlisten disposes a listener only once", async () => {
  let calls = 0;
  const unlisten = makeSafeTauriUnlisten(async () => {
    calls += 1;
  });

  unlisten();
  unlisten();
  await Promise.resolve();

  assert.equal(calls, 1);
});

test("safe Tauri unlisten handles stale callback registry failures", async () => {
  const unlisten = makeSafeTauriUnlisten(async () => {
    throw new TypeError("undefined is not an object (evaluating 'listeners[eventId].handlerId')");
  });

  unlisten();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(
    isStaleTauriListenerError(
      new TypeError("undefined is not an object (evaluating 'listeners[eventId].handlerId')"),
    ),
    true,
  );
});
