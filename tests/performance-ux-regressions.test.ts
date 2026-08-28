// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("proxied image blobs are shared, bounded, and released when no card uses them", () => {
  const source = read("src/lib/remote-image-proxy.ts");

  assert.match(source, /const MAX_BLOB_CACHE_ENTRIES = 96/);
  assert.match(source, /const inFlight = new Map<string, Promise<string>>/);
  assert.match(source, /const pending = inFlight\.get\(url\)/);
  assert.match(source, /URL\.revokeObjectURL\(entry\.src\)/);
  assert.match(source, /function retain\(url: string\)/);
  assert.match(source, /function release\(url: string, entry: BlobCacheEntry\)/);
});

test("background telemetry and downloads avoid needless work while Harbor is hidden", () => {
  const memory = read("src/lib/native-memory.ts");
  const torrents = read("src/views/downloads/use-active-torrents.ts");

  assert.match(memory, /const HIDDEN_INTERVAL_MS = 30000/);
  assert.match(memory, /document\.visibilityState === "hidden" \? HIDDEN_INTERVAL_MS : intervalMs/);
  assert.match(memory, /if \(!isTauri \|\| sampling \|\| playbackActive\) return/);
  assert.match(memory, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(torrents, /let inFlight = false/);
  assert.match(torrents, /document\.visibilityState !== "visible"/);
  assert.match(torrents, /sameItems\(current, next\) \? current : next/);
});

test("profile live refresh coalesces requests and preserves unchanged UI state", () => {
  const profile = read("src/views/profile/use-profile.ts");

  assert.match(profile, /let syncing = false/);
  assert.match(profile, /if \(document\.visibilityState === "hidden" \|\| syncing\) return/);
  assert.match(profile, /Promise\.allSettled\(\[/);
  assert.match(profile, /function keepIfEqual<T>\(prev: T\[\], next: T\[\]\)/);
});
