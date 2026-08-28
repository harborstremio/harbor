// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("page warming is opt-in and keeps uncommon routes lazy", () => {
  const app = read("src/App.tsx");
  const start = app.indexOf("function useViewPreloader");
  const body = app.slice(start, app.indexOf("const KEEP_ALIVE_MS", start));

  assert.match(body, /if \(!enabled \|\| typeof window === "undefined"\) return/);
  assert.match(body, /void importDetail\(\)/);
  assert.match(body, /void importPlayPicker\(\)/);
  assert.doesNotMatch(body, /void importAddons\(\)/);
  assert.doesNotMatch(body, /void importAnime\(\)/);
  assert.match(app, /useViewPreloader\(settings\.tmdbKey, settings\.preloadViews\)/);
});

test("controller polling stays idle without a web gamepad", () => {
  const source = read("src/lib/gamepad/web-source.ts");
  const runner = read("src/components/gamepad-runner.tsx");

  assert.match(source, /window\.setTimeout\(\(\) => \{[\s\S]*?\}, 1500\)/);
  assert.match(source, /window\.addEventListener\("gamepadconnected", onConnection\)/);
  assert.doesNotMatch(source, /raf = requestAnimationFrame\(poll\)/);
  assert.match(runner, /!settings\.controllerSupportEnabled \|\| gamepads\.length === 0/);
});

test("artwork and EPG caches have finite bounds", () => {
  const artwork = read("src/lib/expanding-card-artwork.ts");
  const epg = read("src/lib/iptv/epg-store.ts");

  assert.match(artwork, /const decoded = new Map<string, true>\(\)/);
  assert.match(artwork, /while \(decoded\.size > ARTWORK_CACHE_MAX\)/);
  assert.match(epg, /const MAX_CACHED_PLAYLISTS = 3/);
  assert.match(epg, /while \(cache\.size > MAX_CACHED_PLAYLISTS\)/);
});

