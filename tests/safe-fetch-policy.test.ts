// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  hasSensitiveRequestHeaders,
  isHarborFetchPolicyError,
  shouldFallbackToPluginHttp,
} from "../src/lib/fetch-fallback-policy.ts";

test("plugin HTTP fallback never retries a request carrying credentials", () => {
  for (const name of [
    "Authorization",
    "Proxy-Authorization",
    "X-API-Key",
    "Api-Key",
    "X-Auth-Token",
    "X-Harbor-Auth",
    "X-Harbor-Subtitle-Credential",
    "Cookie",
  ]) {
    assert.equal(hasSensitiveRequestHeaders({ [name]: "secret" }), true, name);
    assert.equal(
      shouldFallbackToPluginHttp(new Error("send: offline"), {
        headers: { [name]: "secret" },
      }),
      false,
      name,
    );
  }
});

test("plugin HTTP fallback preserves native fetch policy failures", () => {
  for (const message of [
    "blocked internal target: 127.0.0.1",
    "too many redirects",
    "redirect from HTTPS to HTTP is not allowed",
    "cross-origin redirect cannot forward request body",
    "response size limit exceeded",
    "subtitle credential origin is not allowed",
  ]) {
    assert.equal(isHarborFetchPolicyError(message), true, message);
    assert.equal(shouldFallbackToPluginHttp(message), false, message);
  }
  assert.equal(shouldFallbackToPluginHttp(new Error("send: offline")), true);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(shouldFallbackToPluginHttp(circular), true);
});
