// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const frontend = readFileSync(new URL("../src/lib/app-icon.ts", import.meta.url), "utf8");
const native = readFileSync(new URL("../src-tauri/src/app_icon.rs", import.meta.url), "utf8");
const displayFit = readFileSync(
  new URL("../src-tauri/src/display_fit.rs", import.meta.url),
  "utf8",
);

test("custom app icons are gated to desktop runtimes", () => {
  assert.match(frontend, /osClass\(\) === "android" \|\| osClass\(\) === "web"/);
});

test("native icon failures are returned instead of reported as success", () => {
  assert.match(native, /pub async fn set_app_icon/);
  assert.match(native, /failed to decode app icon/);
  assert.match(native, /failed to set app icon/);
  assert.doesNotMatch(native, /if let Err\(e\) = set_macos_dock_icon/);
});

test("window position is clamped even when no resize is needed", () => {
  assert.match(displayFit, /let resized =/);
  assert.match(displayFit, /clamp_origin\(position\.x/);
  assert.doesNotMatch(displayFit, /if \(want_w - cur_w\)[\s\S]{0,160}?return;/);
});
