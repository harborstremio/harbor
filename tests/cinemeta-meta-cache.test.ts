// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { meta, settleWithin } from "../src/lib/cinemeta.ts";

function response(name: string): Response {
  return new Response(JSON.stringify({ meta: { id: "tt-cache", type: "series", name } }), {
    headers: { "content-type": "application/json" },
  });
}

test("Cinemeta coalesces concurrent non-force meta requests and reuses the settled result", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveFetch: ((value: Response) => void) | undefined;
  globalThis.fetch = (() => {
    calls += 1;
    return new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  }) as typeof fetch;

  try {
    const first = meta("series", "tt-cache-contract");
    const second = meta("series", "tt-cache-contract");
    assert.equal(calls, 1);

    resolveFetch?.(response("Shared result"));
    assert.equal((await first)?.name, "Shared result");
    assert.equal((await second)?.name, "Shared result");
    assert.equal((await meta("series", "tt-cache-contract"))?.name, "Shared result");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cinemeta force requests bypass the cached result and refresh it", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => response(`Result ${++calls}`)) as typeof fetch;

  try {
    assert.equal((await meta("series", "tt-force-contract"))?.name, "Result 1");
    assert.equal((await meta("series", "tt-force-contract"))?.name, "Result 1");
    assert.equal((await meta("series", "tt-force-contract", true))?.name, "Result 2");
    assert.equal((await meta("series", "tt-force-contract"))?.name, "Result 2");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cinemeta expires results and evicts the oldest entry at its bounded cache size", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = 1_000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = (() => response(`Result ${++calls}`)) as typeof fetch;

  try {
    assert.equal((await meta("series", "tt-ttl-contract"))?.name, "Result 1");
    now += 20_001;
    assert.equal((await meta("series", "tt-ttl-contract"))?.name, "Result 2");

    for (let index = 0; index <= 100; index += 1) {
      await meta("series", `tt-bounded-${index}`);
    }
    const callsBeforeOldestLookup = calls;
    await meta("series", "tt-bounded-0");
    assert.equal(calls, callsBeforeOldestLookup + 1);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("episode enrichment settles a stalled Cinemeta request by its network deadline", async () => {
  await assert.rejects(
    settleWithin(new Promise<never>(() => {}), 1),
    (error: unknown) => error instanceof DOMException && error.name === "TimeoutError",
  );
});
