// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const entrySource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../src/views/home.tsx", import.meta.url), "utf8");
const loaderSource = readFileSync(
  new URL("../src/components/harbor-loader.tsx", import.meta.url),
  "utf8",
);
let startupLoaderSource = "";
try {
  startupLoaderSource = readFileSync(
    new URL("../src/components/startup-loader.tsx", import.meta.url),
    "utf8",
  );
} catch {}
const nativeSource = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");

test("startup keeps the app inert behind the existing loader until the first view is ready", () => {
  assert.match(indexSource, /<div id="root" inert data-startup-hidden><\/div>/);
  assert.match(indexSource, /#root\[data-startup-hidden\][\s\S]*?visibility:\s*hidden/);
  assert.doesNotMatch(indexSource, /<div id="harbor-boot">[\s\S]*?<svg/);
  assert.match(entrySource, /import \{ StartupLoader \}/);
  assert.match(startupLoaderSource, /createPortal\([\s\S]*?<HarborLoader[\s\S]*?onReady=/);
  assert.match(startupLoaderSource, /document\.getElementById\("harbor-boot"\)/);
  assert.match(entrySource, /<App onReady=/);
  assert.doesNotMatch(entrySource, /\);\n\nrequestAnimationFrame\(\(\) => \{[\s\S]*?harbor-boot/);
  assert.match(appSource, /<Home active=\{homeTop\} onReady=\{onReady\}/);
  assert.match(homeSource, /if \(!active \|\| !heroReady\) return;[\s\S]*?onReady\?\.\(\)/);
  assert.match(loaderSource, /onReady\?\.\(\)/);
  assert.match(loaderSource, /container\.replaceChildren\(\)/);
  assert.doesNotMatch(startupLoaderSource, /classList\.add\("gone"\)|setTimeout/);
});

test("native focus is delayed until the single startup surface is removed", () => {
  const pageLoadHandler = nativeSource.match(/\.on_page_load\([\s\S]*?\n\s*\}\)\n\s*\.setup/)?.[0];

  assert.ok(pageLoadHandler, "main page-load handler must exist");
  assert.match(pageLoadHandler, /window\(\)\.show\(\)/);
  assert.doesNotMatch(pageLoadHandler, /set_focus/);
  assert.match(nativeSource, /fn harbor_startup_ready[\s\S]*?window\.set_focus\(\)/);
  assert.match(
    entrySource,
    /setStartupVisible\(false\);[\s\S]*?removeAttribute\("data-startup-hidden"\)[\s\S]*?harbor_startup_ready/,
  );
});

test("windows webview stays opaque while browsing and has fail-open show", () => {
  // Opaque by default — not always-on alpha=0 transparency at setup.
  assert.match(nativeSource, /webview_helpers::apply_opaque/);
  assert.doesNotMatch(nativeSource, /make_main_transparent\(/);
  assert.match(nativeSource, /fail-open: showing main after page-load timeout/);
  assert.match(nativeSource, /WEBVIEW_SUSPENDED/);
  assert.match(nativeSource, /resume_webview_if_needed/);
});
