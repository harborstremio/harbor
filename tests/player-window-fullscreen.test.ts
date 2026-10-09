// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const windowControlsSource = readFileSync(
  new URL("../src/components/player/transport/window-control-buttons.tsx", import.meta.url),
  "utf8",
);

test("the player window control uses shared fullscreen unless maximize mode is selected", () => {
  assert.match(
    windowControlsSource,
    /import \{ toggleWindowFullscreen \} from "@\/lib\/fullscreen-state";/,
  );
  assert.match(
    windowControlsSource,
    /import \{ useWindowFullscreen \} from "@\/lib\/use-window-fullscreen";/,
  );
  assert.match(
    windowControlsSource,
    /import \{ close, minimize, toggleMaximize, useMaximized \} from "@\/lib\/window";/,
  );
  assert.match(windowControlsSource, /const fullscreen = useWindowFullscreen\(\);/);
  assert.match(windowControlsSource, /const maximized = useMaximized\(\);/);
  assert.match(
    windowControlsSource,
    /const maximizeInstead = settings\.fullscreenMode === "maximized";/,
  );
  assert.match(
    windowControlsSource,
    /onClick=\{maximizeInstead \? toggleMaximize : \(\) => void toggleWindowFullscreen\(\)\}/,
  );
  assert.match(windowControlsSource, /maximizeInstead[\s\S]*t\("chrome\.restore"\)/);
  assert.match(windowControlsSource, /fullscreen[\s\S]*t\("Exit fullscreen"\)/);
  assert.match(windowControlsSource, /fullscreen[\s\S]*t\("Fullscreen"\)/);
});
