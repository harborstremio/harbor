// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { buildStreamIds } from "../src/lib/streams/stream-ids.ts";

test("TMDB movies query the bare addon id before the type-scoped id", () => {
  assert.deepEqual(buildStreamIds("tmdb:movie:123", undefined, null), [
    "tmdb:123",
    "tmdb:movie:123",
  ]);
});

test("TMDB episodes query both bare and type-scoped addon ids", () => {
  const ids = buildStreamIds("tmdb:tv:456", { season: 2, episode: 3 }, "tt1234567");
  assert.deepEqual(ids.slice(0, 2), ["tmdb:456:2:3", "tmdb:tv:456:2:3"]);
  assert.ok(ids.includes("tt1234567:2:3"));
});

test("an already-bare TMDB id is not duplicated", () => {
  assert.deepEqual(buildStreamIds("tmdb:789", undefined, null), ["tmdb:789"]);
});
