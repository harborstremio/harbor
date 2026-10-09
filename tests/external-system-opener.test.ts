import assert from "node:assert/strict";
import test from "node:test";
import {
  openExternalUrlStrict,
  type ExternalUrlOpenAdapter,
} from "../src/lib/social/external-system-opener.ts";

function adapter(overrides: Partial<ExternalUrlOpenAdapter> = {}): ExternalUrlOpenAdapter {
  return { isTauri: false, openTauri: async () => {}, openWeb: () => {}, ...overrides };
}

test("normalizes and invokes the native opener exactly once", async () => {
  const calls: string[] = [];
  await openExternalUrlStrict(
    "https://Example.com/path",
    adapter({ isTauri: true, openTauri: async (href) => void calls.push(href) }),
  );
  assert.deepEqual(calls, ["https://example.com/path"]);
});

test("uses noopener,noreferrer on web without inferring failure from a void return", async () => {
  const calls: string[][] = [];
  await openExternalUrlStrict(
    "https://example.com",
    adapter({ openWeb: (...args) => void calls.push(args) }),
  );
  assert.deepEqual(calls, [["https://example.com/", "_blank", "noopener,noreferrer"]]);
});

test("rejects unsafe input and surfaces native rejection", async () => {
  let called = false;
  await assert.rejects(
    openExternalUrlStrict("javascript:alert(1)", adapter({ openWeb: () => void (called = true) })),
    /valid external link/i,
  );
  assert.equal(called, false);
  let webFallbackCalled = false;
  await assert.rejects(
    openExternalUrlStrict(
      "https://example.com",
      adapter({
        isTauri: true,
        openTauri: async () => {
          throw new Error("no browser configured");
        },
        openWeb: () => {
          webFallbackCalled = true;
        },
      }),
    ),
    /no browser configured/,
  );
  assert.equal(webFallbackCalled, false);
});
