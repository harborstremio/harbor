// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { startupCrashToHarborError } from "../src/lib/startup-crash.ts";

test("native panic recovery uses the existing opt-in error report experience", () => {
  const error = startupCrashToHarborError({
    kind: "panic",
    version: "1.2.3",
    platform: "macos",
    message: "boom",
    location: "src/main.rs:7:2",
    backtrace: "trace",
  });

  assert.equal(error.code, "NativePanic");
  assert.equal(error.title, "Previous native crash");
  assert.match(error.message, /crashed the last time/i);
  assert.match(error.detail ?? "", /Version: 1.2.3/);
  assert.match(error.detail ?? "", /Platform: macos/);
  assert.match(error.detail ?? "", /boom/);
  assert.match(error.detail ?? "", /trace/);
  assert.equal(error.fatal, false);
});

test("startup recovery does not classify marker-only exits as crashes", () => {
  const source = readFileSync(new URL("../src/lib/startup-crash.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /UncleanShutdown/);
  assert.doesNotMatch(source, /Previous unclean shutdown/);
});
