// @ts-nocheck -- Node's test modules are not included in the application tsconfig.
import assert from "node:assert/strict";
import test from "node:test";
import { StreamSwitchGuard } from "../src/views/player/hooks/stream-switch-guard.ts";

test("a replacement swap preserves the initial playback state", () => {
  const guard = new StreamSwitchGuard();
  const first = guard.begin(true);
  const replacement = guard.begin(false);

  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.shouldResumeOnFailure(replacement), true);
});

test("a stale swap cannot finish the replacement swap", () => {
  const guard = new StreamSwitchGuard();
  const first = guard.begin(true);
  const replacement = guard.begin(false);

  guard.finish(first);
  assert.equal(guard.isCurrent(replacement), true);
  assert.equal(guard.shouldResumeOnFailure(replacement), true);
});

test("a completed swap starts the next session from current playback state", () => {
  const guard = new StreamSwitchGuard();
  const first = guard.begin(true);
  guard.finish(first);
  const next = guard.begin(false);

  assert.equal(guard.shouldResumeOnFailure(next), false);
});
