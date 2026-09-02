// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const read = (p: string) => readFileSync(at(p), "utf8");
const simkl = read("src/lib/simkl/scrobble-hook.ts");
const trakt = read("src/lib/trakt/scrobble-hook.ts");
const safeFetch = read("src/lib/safe-fetch.ts");
const simklClient = read("src/lib/simkl/client.ts");

test("no tracker gates its pause behind a setting with no UI", () => {
  for (const [name, src] of [
    ["simkl", simkl],
    ["trakt", trakt],
  ] as const) {
    assert.doesNotMatch(
      src,
      /pauseOnPauseRef|pauseListStatusOnPause/,
      `${name} pause is gated again; the flag has no UI so the gate is always off`,
    );
  }
});

test("pausing playback always tells the tracker", () => {
  for (const [name, src] of [
    ["simkl", simkl],
    ["trakt", trakt],
  ] as const) {
    const branch = src.match(
      /status === "paused" && lastActionRef\.current === "start"\)\s*\{[\s\S]{0,220}?\n\s{4}\}/,
    );
    assert.ok(branch, `${name} has no paused branch`);
    assert.match(branch[0], /"pause"/, `${name} does not send pause`);
    assert.doesNotMatch(branch[0], /if \(/, `${name} still guards the pause send`);
  }
});

test("the Simkl exit send uses a transport that survives teardown", () => {
  const beacon = simkl.slice(simkl.indexOf("function sendBeacon"));
  assert.match(beacon, /void fetch\(url\.toString\(\), \{/);
  assert.doesNotMatch(beacon, /safeFetch/);
  assert.match(beacon, /keepalive: true/);
  assert.match(safeFetch, /timeoutMs: 30000,/);
  assert.doesNotMatch(
    safeFetch.slice(
      safeFetch.indexOf('invoke<HarborFetchResponse>("harbor_fetch"'),
      safeFetch.indexOf('invoke<HarborFetchResponse>("harbor_fetch"') + 320,
    ),
    /keepalive/,
    "if harbor_fetch ever forwards keepalive, revisit whether the beacon still needs native fetch",
  );
});

test("the Simkl exit send does not queue behind the POST throttle", () => {
  assert.match(simklClient, /const POST_MIN_GAP_MS = 1050;/);
  const unmount = simkl.slice(simkl.lastIndexOf("return () => {"));
  assert.match(unmount, /sendBeacon\(/, "unmount must beacon, not go through the queued client");
  assert.doesNotMatch(
    unmount,
    /simklScrobble\(/,
    "simklScrobble waits on queueTail and can sleep 1050ms",
  );
});

test("Simkl and Trakt agree on when a session is finished", () => {
  const pct = (s: string) => s.match(/WATCHED_MARK_PCT\s*=\s*([\d.]+)/)?.[1];
  assert.ok(trakt.includes("const WATCHED_MARK_PCT = 70;"));
  assert.ok(pct(simkl) || simkl.includes("SIMKL_WATCHED_RATIO"));
});

test("Simkl does not write an early EOF directly to watched history", () => {
  const ended = simkl.slice(
    simkl.indexOf('if (snap.status === "ended")'),
    simkl.indexOf("if (!loadResetSeenRef.current)"),
  );
  assert.match(ended, /if \(endPct >= WATCHED_MARK_PCT\)/);
  assert.match(ended, /recordWatchedFallback/);
});
