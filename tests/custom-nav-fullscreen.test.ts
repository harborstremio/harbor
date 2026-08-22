// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const customNavigationSources = [
  "../src/chrome/topdock.tsx",
  "../src/chrome/cinematic-overlay.tsx",
  "../src/chrome/minui-dock/floating-top.tsx",
  "../src/chrome/siderail.tsx",
  "../src/chrome/royal-topbar.tsx",
].map((path) => ({ path, source: readFileSync(new URL(path, import.meta.url), "utf8") }));

test("custom navigation layouts use Harbor's native fullscreen control", () => {
  for (const { path, source } of customNavigationSources) {
    assert.match(
      source,
      /import \{ toggleWindowFullscreen \} from "@\/lib\/fullscreen-state";/,
      `${path} must toggle native fullscreen`,
    );
    assert.match(
      source,
      /import \{ useWindowFullscreen \} from "@\/lib\/use-window-fullscreen";/,
      `${path} must display the native fullscreen state`,
    );
    assert.match(source, /onClick=\{\(\) => void toggleWindowFullscreen\(\)\}/);
    assert.doesNotMatch(source, /toggleMaximize|useMaximized/);
  }
});
