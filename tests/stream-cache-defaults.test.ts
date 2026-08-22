// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

test("stream cache defaults are ephemeral and swept on startup", () => {
  const frontendDefaults = readFileSync("src/lib/settings/defaults.ts", "utf8");
  const engine = readFileSync("src-tauri/src/torrent_engine.rs", "utf8");

  assert.match(frontendDefaults, /streamCacheRetentionHours:\s*0,/);
  assert.match(engine, /retention_hours\.unwrap_or\(0\)/);
  assert.doesNotMatch(engine, /CACHE_SWEEP_INITIAL_DELAY_SECS/);
});
