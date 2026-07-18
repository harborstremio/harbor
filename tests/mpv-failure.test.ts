// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { mpvFailureSnapshot } from "../src/lib/player/mpv-failure.ts";
import { emptySnapshot } from "../src/lib/player/bridge.ts";

test("persistent mpv event failures become a visible player error", () => {
  const snapshot = mpvFailureSnapshot(
    { ...emptySnapshot, status: "playing", positionSec: 42 },
    "persistent-event-errors",
  );

  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.errorCode, "unknown");
  assert.equal(snapshot.errorMessage, "The native player stopped responding.");
  assert.equal(snapshot.positionSec, 42);
});
