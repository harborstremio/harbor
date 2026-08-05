// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (p: string) => new URL(`../${p}`, import.meta.url);
const mpv = readFileSync(at("src-tauri/src/mpv.rs"), "utf8");
const prune = readFileSync(at("src-tauri/src/temp_prune.rs"), "utf8");
const lib = readFileSync(at("src-tauri/src/lib.rs"), "utf8");

test("mpv still writes its demuxer cache to a directory on disk", () => {
  assert.match(mpv, /let dvr = base\.join\("mpv-cache"\);/);
  assert.match(mpv, /set_property\("cache-on-disk", "yes"\)/);
});

test("every unbounded on-disk cache Harbor writes has a sweeper", () => {
  assert.match(prune, /pub fn sweep_mpv_cache\(dir: PathBuf\) -> u64/);
  assert.match(prune, /const MPV_CACHE_MAX_AGE: Duration/);
  assert.match(lib, /temp_prune::sweep_mpv_cache\(base\.join\("mpv-cache"\)\)/);
});

test("the sweep only reclaims entries old enough to be orphans", () => {
  const fn = prune.slice(prune.indexOf("pub fn sweep_mpv_cache"));
  assert.match(fn, /if age < MPV_CACHE_MAX_AGE \{\s*\n\s*continue;/);
  assert.match(fn, /remove_dir_all\(&path\)\.is_ok\(\)/);
  assert.match(fn, /remove_file\(&path\)\.is_ok\(\)/);
});

test("the torrent cache keeps its own cap and retention", () => {
  const defaults = readFileSync(at("src/lib/settings/defaults.ts"), "utf8");
  assert.match(defaults, /streamCacheRetentionHours: \d+/);
  assert.match(defaults, /streamCacheMaxGb: \d+/);
  const app = readFileSync(at("src/App.tsx"), "utf8");
  assert.match(app, /torrentEngineSetOptions\(/);
  assert.match(app, /settings\.streamCacheMaxGb/);
});
