// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  canStartSubtitleAutoload,
  loadFirstWorkingSubtitle,
  subtitleSearchImdbId,
  withSubtitleTimeout,
} from "../src/lib/subtitles/autoload.ts";

test("autoload waits until subtitle addons have settled", () => {
  assert.equal(
    canStartSubtitleAutoload({ imdbId: "tt123", mediaReady: true, addons: null }),
    false,
  );
  assert.equal(canStartSubtitleAutoload({ imdbId: "tt123", mediaReady: true, addons: [] }), true);
});

test("automatic search never sends an unverified IMDb fallback", () => {
  assert.equal(subtitleSearchImdbId("tt123", false), undefined);
  assert.equal(subtitleSearchImdbId("tt456", true), "tt456");
});

test("a stalled subtitle provider resolves to its fallback at the deadline", async () => {
  const never = new Promise<string[]>(() => {});
  const started = Date.now();
  const result = await withSubtitleTimeout(never, 15, []);
  assert.deepEqual(result, []);
  assert.ok(Date.now() - started < 250);
});

test("autoload stops after the first subtitle that loads", async () => {
  const attempts: string[] = [];
  const selected = await loadFirstWorkingSubtitle(
    ["broken-1", "broken-2", "working", "unused"],
    async (candidate) => {
      attempts.push(candidate);
      return candidate === "working";
    },
  );
  assert.equal(selected, "working");
  assert.deepEqual(attempts, ["broken-1", "broken-2", "working"]);
});

test("autoload caps fallback downloads", async () => {
  const attempts: string[] = [];
  const selected = await loadFirstWorkingSubtitle(
    ["one", "two", "three", "four"],
    async (candidate) => {
      attempts.push(candidate);
      return false;
    },
    3,
  );
  assert.equal(selected, null);
  assert.deepEqual(attempts, ["one", "two", "three"]);
});
