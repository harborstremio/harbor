// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { canFallbackAfterNativeFetchError } from "../src/lib/safe-fetch-policy.ts";

test("does not bypass the native response size limit through fallback", () => {
  assert.equal(canFallbackAfterNativeFetchError("response body exceeds 16777216 bytes"), false);
  assert.equal(
    canFallbackAfterNativeFetchError(new Error("response body exceeds 16777216 bytes")),
    false,
  );
});

test("allows fallback for transport failures", () => {
  assert.equal(canFallbackAfterNativeFetchError(new Error("connection refused")), true);
});
