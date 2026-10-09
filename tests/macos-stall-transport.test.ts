// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  classifyDirectFailure,
  clearDirectFailures,
  directHostFor,
  isDirectHostDemoted,
  noteDirectFailure,
  resetDirectHostPolicy,
} from "../src/lib/direct-host-policy.ts";
import {
  bridgeRows,
  formatBridgeSection,
  recordBridge,
  resetBridgeStats,
  bridgeOutcome,
} from "../src/lib/fetch-bridge-stats.ts";

const CINEMETA = "https://v3-cinemeta.strem.io/catalog/movie/top.json";
const TMDB = "https://api.themoviedb.org/3/movie/550";

test("a direct attempt that hangs until its own timeout falls back and demotes the host", () => {
  resetDirectHostPolicy();
  const verdict = classifyDirectFailure({
    callerAborted: false,
    timedOut: true,
    cancelled: true,
    idempotent: true,
  });
  assert.equal(verdict.action, "fallback");
  assert.equal(verdict.outcome, "timeout");
  assert.equal(verdict.demote, true);
});

test("a timed out write is demoted but never replayed on the other bridge", () => {
  resetDirectHostPolicy();
  const verdict = classifyDirectFailure({
    callerAborted: false,
    timedOut: true,
    cancelled: true,
    idempotent: false,
  });
  assert.equal(verdict.action, "giveUp");
  assert.equal(verdict.outcome, "timeout");
  assert.equal(verdict.demote, true);
});

test("a caller abort is never mistaken for a failing host", () => {
  resetDirectHostPolicy();
  const verdict = classifyDirectFailure({
    callerAborted: true,
    timedOut: true,
    cancelled: true,
    idempotent: true,
  });
  assert.equal(verdict.action, "rethrow");
  assert.equal(verdict.outcome, "abort");
  assert.equal(verdict.demote, false);
  const cancelled = classifyDirectFailure({
    callerAborted: false,
    timedOut: false,
    cancelled: true,
    idempotent: true,
  });
  assert.equal(cancelled.action, "rethrow");
  assert.equal(cancelled.demote, false);
});

test("a plain transport error still falls back and demotes", () => {
  const verdict = classifyDirectFailure({
    callerAborted: false,
    timedOut: false,
    cancelled: false,
    idempotent: false,
  });
  assert.equal(verdict.action, "fallback");
  assert.equal(verdict.outcome, "error");
  assert.equal(verdict.demote, true);
});

test("two failures demote a direct host for the decay window and one success clears it", () => {
  resetDirectHostPolicy();
  const start = 1_000_000;
  assert.equal(directHostFor(CINEMETA, start), "v3-cinemeta.strem.io");
  noteDirectFailure("v3-cinemeta.strem.io", start);
  assert.equal(directHostFor(CINEMETA, start + 10), "v3-cinemeta.strem.io");
  noteDirectFailure("v3-cinemeta.strem.io", start + 10);
  assert.equal(isDirectHostDemoted("v3-cinemeta.strem.io", start + 20), true);
  assert.equal(directHostFor(CINEMETA, start + 20), null);
  assert.equal(directHostFor(CINEMETA, start + 60_010), "v3-cinemeta.strem.io");

  noteDirectFailure("api.themoviedb.org", start);
  noteDirectFailure("api.themoviedb.org", start + 10);
  assert.equal(directHostFor(TMDB, start + 20), null);
  clearDirectFailures("api.themoviedb.org");
  assert.equal(directHostFor(TMDB, start + 20), "api.themoviedb.org");
});

test("a non https host is never promoted to the direct path", () => {
  resetDirectHostPolicy();
  assert.equal(directHostFor("http://v3-cinemeta.strem.io/x"), "v3-cinemeta.strem.io");
  assert.equal(directHostFor("not a url"), null);
  assert.equal(directHostFor("https://example.invalid/x"), null);
});

test("the dump names the host and bridge behind a stalled request", () => {
  resetBridgeStats();
  recordBridge("direct", CINEMETA, 8003, "timeout");
  recordBridge("direct", CINEMETA, 8001, "timeout");
  recordBridge("harborFetch", CINEMETA, 240, "ok");
  const rows = bridgeRows();
  assert.equal(rows[0].key, "direct v3-cinemeta.strem.io");
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].outcomes.timeout, 2);
  assert.equal(rows[0].p95Ms, 8003);
  assert.equal(rows[1].key, "harborFetch v3-cinemeta.strem.io");
  const text = formatBridgeSection(rows).join("\n");
  assert.match(text, /direct v3-cinemeta\.strem\.io/);
  assert.match(text, /0\/0\/2\/0/);
  resetBridgeStats();
  assert.equal(bridgeRows().length, 0);
  assert.match(formatBridgeSection([]).join("\n"), /no bridged requests recorded/);
});

test("bridge outcomes separate an abort from a deadline from a real error", () => {
  assert.equal(bridgeOutcome({ name: "AbortError" }), "abort");
  assert.equal(bridgeOutcome({ name: "TimeoutError" }), "timeout");
  assert.equal(bridgeOutcome(new Error("harbor_fetch exceeded deadline")), "timeout");
  assert.equal(bridgeOutcome(new Error("timeout after 30000 ms")), "timeout");
  assert.equal(bridgeOutcome(new Error("send: offline")), "error");
});

test("a dump from a webview with no heap api says so instead of printing zero", async () => {
  const { buildDumpText } = await import("../src/lib/memory-dump-text.ts");
  const base = {
    now: 1_700_000_000_000,
    elapsedSec: 21.9,
    baselineHeapMB: 0,
    currentHeapMB: 0,
    peakHeapMB: 0,
    dom: { nodes: 16415, imgs: 986, vids: 0 },
    networkBytes: 13_589_544,
    events: [],
    navStack: [],
    caches: [],
    cacheHistory: new Map<string, number[]>(),
    renderReport: [],
    nativeMem: { harborRss: 512, webviewRss: 0, total: 512 },
    ramTier: "high",
    drift: { ticks: 20, maxDriftMs: 6, stalls: 0, hiddenTicks: 0 },
    bridges: [],
  };
  const blind = buildDumpText({
    ...base,
    capabilities: { jsHeap: false, longTasks: false, nativeRss: true },
  });
  assert.match(blind, /performance\.memory is not implemented/);
  assert.match(blind, /performance\.memory:      MISSING/);
  assert.match(blind, /longtask observer:       MISSING/);
  assert.match(blind, /no longtask observer on this webview/);
  assert.doesNotMatch(blind, /main thread stayed responsive/);
  assert.match(blind, /webview not attributed on this platform/);
  assert.match(blind, /nothing calls recordRender/);
  const full = buildDumpText({
    ...base,
    currentHeapMB: 240,
    capabilities: { jsHeap: true, longTasks: true, nativeRss: true },
  });
  assert.match(full, /current heap:  240\.0 MB/);
  assert.match(full, /the webview never blocked for 50ms/);
});
