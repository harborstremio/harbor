import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const native = read("src-tauri/src/hdr_overlay.rs");
const startupScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function startupStyles(search) {
  const styles = [];
  runInNewContext(startupScript, {
    URLSearchParams,
    window: { location: { search } },
    document: {
      createElement: () => ({ textContent: "" }),
      head: { appendChild: (style) => styles.push(style.textContent) },
    },
  });
  return styles.join("\n");
}

test("HDR overlay suppresses the boot logo before the application bundle runs", () => {
  assert.match(startupStyles("?harbor-overlay=1"), /#harbor-boot\s*\{\s*display:\s*none/);
});

test("HDR overlay starts transparent even if the bundle cannot load", () => {
  assert.match(
    startupStyles("?harbor-overlay=1"),
    /html,\s*body,\s*#root\s*\{\s*background:\s*transparent/,
  );
});

test("main-window startup and the existing modal splash rule are preserved", () => {
  assert.equal(startupStyles(""), "");
  assert.equal(startupStyles("?harbor-overlay=0"), "");
  assert.match(startupStyles("?harbor-modal=1"), /#harbor-boot\s*\{\s*display:\s*none/);
});

test("native HDR creation does not block the UI event loop or async runtime workers", () => {
  assert.match(native, /spawn_blocking/);
  assert.doesNotMatch(native, /run_on_main_thread|rx\.recv/);
});

test("HDR overlay is owned by Harbor rather than globally topmost", () => {
  assert.match(native, /\.parent\(&main\)/);
  assert.doesNotMatch(native, /\.always_on_top\(true\)/);
  assert.match(native, /browser_args::match_main/);
  assert.match(native, /\.transparent\(true\)/);
});

test("open, hide and close serialize so a late creation cannot outlive cleanup", () => {
  for (const operation of ["open", "hide", "close"]) {
    const body = native
      .split(`pub async fn hdr_overlay_${operation}(`)[1]
      ?.split("#[tauri::command]")[0];
    assert.match(body, /HDR_OVERLAY_OPERATION\.lock\(\)\.await/);
  }
});
