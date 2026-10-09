// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const lib = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const guard = lib.slice(
  lib.indexOf('unsafe extern "system" fn maxguard_subclass_proc('),
  lib.indexOf("fn install_maximize_guard("),
);

test("background erases are suppressed only inside the interactive resize loop", () => {
  assert.match(guard, /if msg == WM_ENTERSIZEMOVE \{\s*MAIN_IN_SIZE_MOVE\.store\(true/);
  assert.match(
    guard,
    /msg == WM_EXITSIZEMOVE \|\| msg == WM_NCDESTROY[\s\S]*?MAIN_IN_SIZE_MOVE\.store\(false/,
  );
  assert.match(guard, /if msg == WM_ERASEBKGND && MAIN_IN_SIZE_MOVE\.load\(/);
  assert.match(guard, /let res = DefSubclassProc\(hwnd, msg, wparam, lparam\)/);
});

test("the main window background is black, without making the video WebView opaque", () => {
  const config = JSON.parse(
    readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(
    config.app.windows.find((w: { label: string }) => w.label === "main").backgroundColor,
    [0, 0, 0, 255],
  );
  assert.match(lib, /COREWEBVIEW2_COLOR \{\s*A: 0,\s*R: 0,\s*G: 0,\s*B: 0,/);
});
