// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a text-sync read failure remains visible as feedback instead of vanishing", () => {
  const hook = read("src/views/player/hooks/use-text-sync.ts");
  const player = read("src/views/player.tsx");

  assert.match(hook, /Promise<string \| null>/);
  assert.match(hook, /return res\.reason;/);
  assert.match(hook, /catch \(e\)[\s\S]*return reason;/);
  assert.match(player, /textSync\.enter\(src\.url, src\.headers\)\.then\(\(reason\) =>/);
  assert.match(player, /showSyncToast\("error"/);
});

test("leaving fullscreen restores the prior window state after the Windows transition", () => {
  const source = read("src-tauri/src/fullscreen.rs");

  assert.match(source, /let maximized = main\.is_maximized\(\)\.unwrap_or\(false\);/);
  assert.match(source, /maximized,/);
  assert.match(source, /tokio::time::sleep\(std::time::Duration::from_millis\(150\)\)\.await/);
  assert.match(source, /if saved\.maximized \{[\s\S]*main\.maximize\(\)/);
  assert.match(source, /PhysicalSize \{ width: saved\.width, height: saved\.height \}/);
});

test("the enabled clock is also rendered in windowed playback", () => {
  const controls = read("src/components/player/transport/control-renderer.tsx");
  const localTime = controls.slice(controls.indexOf('case "local-time":'));

  assert.match(localTime, /return \([\s\S]*<FullscreenClock/);
  assert.doesNotMatch(localTime.slice(0, localTime.indexOf('case "time-start":')), /ctx\.fullscreen \?/);
});
