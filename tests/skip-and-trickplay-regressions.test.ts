// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("skip sources are warmed, cached, and rejected when their confidence is too low", () => {
  const skip = read("src/lib/skip-intro/index.ts");
  const introDbApp = read("src/lib/skip-intro/introdb-app.ts");
  const aniSkip = read("src/lib/skip-intro/aniskip.ts");
  const skipDb = read("src/lib/skip-intro/skipdb.ts");

  assert.match(skip, /fetchAdSegments\(fp\.content, fp\.source\)/);
  assert.doesNotMatch(skip, /fetchAdSegments\(fp\.content, fp\.source, true\)/);
  assert.match(skip, /fetchSkipDbSegments\(tt, ep, 0\)/);
  assert.match(introDbApp, /raw\.confidence < 0\.35/);
  assert.match(aniSkip, /const warmSegmentCache/);
  assert.match(skipDb, /const warmCache/);
});

test("localized chapter names can drive skip detection", () => {
  const chapters = read("src/lib/skip-intro/chapters.ts");

  assert.match(chapters, /bevezető\|főcím\|nyitány/);
  assert.match(chapters, /stáblista/);
  assert.match(chapters, /összefoglaló/);
});

test("trickplay avoids live streams and keeps its startup path responsive", () => {
  const hook = read("src/views/player/hooks/use-trickplay.ts");
  const thumbs = read("src-tauri/src/thumbs.rs");
  const snapshots = read("src/views/player/hooks/use-exit-snapshot.ts");

  assert.match(hook, /!enabled \|\| !url \|\| isLive/);
  assert.match(thumbs, /const REQUEST_TIMEOUT_MS: u64 = 5000;/);
  assert.match(thumbs, /const SEEK_WAIT_MS: u64 = 1200;/);
  assert.match(thumbs, /const HDR_PROBE_TIMEOUT_MS: u64 = 1200;/);
  assert.match(thumbs, /const SHADOW_STARTUP_CHECK_DELAY: Duration = Duration::from_millis\(40\);/);
  assert.match(thumbs, /cmd\.kill_on_drop\(true\);/);
  assert.match(snapshots, /allowTrick && seek && !getSeekHovering\(\)/);
  assert.match(snapshots, /grabFrame\(false, true\)/);
  assert.match(snapshots, /if \(status === "paused"\) void captureExitSnapshot\(\)/);
});

test("automatic skip and a dismissed pill survive late provider updates", () => {
  const container = read("src/views/player/skip-pill-container.tsx");
  const layers = read("src/views/player/player-overlay-layers.tsx");

  assert.match(container, /useRef<string \| null>\(null\)/);
  assert.match(container, /autoSkippedRef\.current === autoSkipKey/);
  assert.doesNotMatch(container, /autoSkippedRef\.current = null;[\s\S]{0,100}\[skipSegments\]/);
  assert.doesNotMatch(container, /setDismissedKeys\(new Set\(\)\);[\s\S]{0,100}\[skipSegments\]/);
  assert.match(layers, /skipSessionKey=\{`\$\{p\.src\.meta\.id/);
  assert.match(read("src\/views\/player\/tools-layer.tsx"), /<SkipPillContainer[\s\S]*key=\{skipSessionKey\}/);
});
