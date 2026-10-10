import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

test("taskbar-gap paint is restricted to the one-pixel nonclient strip", () => {
  const start = source.indexOf("unsafe fn paint_main_taskbar_gap(");
  const body = source.slice(start, source.indexOf("fn install_maximize_guard", start));
  assert.ok(start >= 0);
  assert.match(body, /!IsZoomed\(hwnd\)\.as_bool\(\)/);
  assert.match(body, /origin\.y \+ client\.bottom != work\.bottom - 1/);
  assert.match(body, /origin\.x \+ client\.right != work\.right/);
  assert.match(body, /GetWindowDC\(Some\(hwnd\)\)/);
  assert.match(body, /ReleaseDC\(Some\(hwnd\), dc\)/);
  assert.doesNotMatch(body, /SetWindowPos|set_size|set_fullscreen|SetWindowLong/);
});

test("only Windows defers the main window's automatic state restore", () => {
  assert.match(source, /#\[cfg\(windows\)\]\s*let builder = builder\.skip_initial_state\("main"\)/);
});

test("startup restores geometry after the maximize guard and before fitting", () => {
  const setup = source.slice(source.indexOf(".setup(move |app|"));
  const guard = setup.indexOf("install_maximize_guard(&app.handle())");
  const restore = setup.indexOf("window.restore_state(");
  const fit = setup.indexOf("display_fit::install(app.handle())");
  assert.ok(guard >= 0 && restore > guard && fit > restore);
  assert.match(setup, /StateFlags::SIZE \| StateFlags::POSITION \| StateFlags::MAXIMIZED/);
});

test("deferred restore does not reveal or focus the window", () => {
  const start = source.indexOf("if let Err(error) = window.restore_state(");
  const restore = source.slice(start, source.indexOf("display_fit::install", start));
  assert.doesNotMatch(restore, /StateFlags::VISIBLE|StateFlags::FULLSCREEN|\.show\(|\.set_focus\(/);
  assert.match(restore, /startup restore failed/);
});
