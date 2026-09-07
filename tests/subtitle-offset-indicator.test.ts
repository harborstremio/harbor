// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  formatSubtitleOffset,
  sanitizeSubtitleOffsetPosition,
  sanitizeSubtitleOffsetSize,
} from "../src/lib/player/subtitle-offset.ts";

const keyboardSource = readFileSync(
  new URL("../src/views/player/hooks/use-keyboard-shortcuts.ts", import.meta.url),
  "utf8",
);
const stageSource = readFileSync(
  new URL("../src/views/player/stage-overlays.tsx", import.meta.url),
  "utf8",
);
const indicatorSource = readFileSync(
  new URL("../src/components/player/subtitle-offset-indicator.tsx", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../src/views/settings/player-panel/subtitle-offset-settings.tsx", import.meta.url),
  "utf8",
);
const syncBarSource = readFileSync(
  new URL("../src/components/player/sub-sync-bar.tsx", import.meta.url),
  "utf8",
);
const syncStoreSource = readFileSync(
  new URL("../src/lib/player/sub-sync.ts", import.meta.url),
  "utf8",
);
const subtitleMenuSource = readFileSync(
  new URL("../src/components/player/subtitle-menu/sync-control.tsx", import.meta.url),
  "utf8",
);
const subtitlesPanelSource = readFileSync(
  new URL("../src/views/settings/subtitles-panel.tsx", import.meta.url),
  "utf8",
);
const defaultsSource = readFileSync(
  new URL("../src/lib/settings/defaults.ts", import.meta.url),
  "utf8",
);
const loadSource = readFileSync(new URL("../src/lib/settings/load.ts", import.meta.url), "utf8");

test("subtitle offsets are displayed as signed milliseconds", () => {
  assert.equal(formatSubtitleOffset(0.3), "+300 ms");
  assert.equal(formatSubtitleOffset(-0.05), "-50 ms");
  assert.equal(formatSubtitleOffset(0), "0 ms");
});

test("both subtitle delay shortcuts show the current offset", () => {
  const down = keyboardSource.match(/match\("playerSubDelayDown"\)[\s\S]*?return;/)?.[0] ?? "";
  const up = keyboardSource.match(/match\("playerSubDelayUp"\)[\s\S]*?return;/)?.[0] ?? "";

  assert.match(down, /showSubtitleOffset\(delay\)/);
  assert.match(up, /showSubtitleOffset\(delay\)/);
  assert.match(keyboardSource, /setTimeout\([\s\S]*?1800/);
  assert.match(stageSource, /<SubtitleOffsetIndicator delaySec=\{subtitleOffsetSec\}/);
});

test("the open subtitle sync bar follows keyboard offset changes", () => {
  assert.match(syncBarSource, /<DelayDisplay value=\{delaySec\}/);
  assert.match(syncBarSource, /round\(delaySec\) !== round\(initialDelaySec\)/);
  assert.doesNotMatch(syncBarSource, /localDelay|setLocalDelay/);
  assert.match(subtitleMenuSource, /openSyncBar\(delaySec\)/);
  assert.match(syncStoreSource, /state = \{ open: true, initialDelaySec \}/);
});

test("subtitle offset feedback rises from the bottom and respects reduced motion", () => {
  assert.match(indicatorSource, /bottom: "bottom-32 left-1\/2 -translate-x-1\/2"/);
  assert.match(indicatorSource, /translate-y-2/);
  assert.match(indicatorSource, /cubic-bezier\(0\.16,1,0\.3,1\)/);
  assert.match(indicatorSource, /motion-reduce:transition-none/);
  assert.doesNotMatch(indicatorSource, /bg-black|backdrop-blur|rounded-full/);
  assert.doesNotMatch(indicatorSource, /transition-all/);
});

test("subtitle offset settings support safe position and size choices", () => {
  assert.equal(sanitizeSubtitleOffsetPosition("top-left"), "top-left");
  assert.equal(sanitizeSubtitleOffsetPosition("right"), "right");
  assert.equal(sanitizeSubtitleOffsetPosition("floating"), "bottom");
  assert.equal(sanitizeSubtitleOffsetSize("large"), "large");
  assert.equal(sanitizeSubtitleOffsetSize("huge"), "medium");

  assert.match(defaultsSource, /subOffsetIndicatorEnabled: true/);
  assert.match(defaultsSource, /subOffsetIndicatorPosition: "bottom"/);
  assert.match(defaultsSource, /subOffsetIndicatorSize: "medium"/);
  assert.match(loadSource, /sanitizeSubtitleOffsetPosition/);
  assert.match(loadSource, /sanitizeSubtitleOffsetSize/);
});

test("subtitle settings expose a preview, nine positions, and three sizes", () => {
  assert.match(subtitlesPanelSource, /<Section[\s\S]*title=\{t\("Sync indicator"\)\}/);
  assert.match(subtitlesPanelSource, /<SubtitleOffsetSettings \/>/);
  assert.match(settingsSource, /<SubtitleOffsetIndicator delaySec=\{0\.3\} preview/);
  assert.equal(
    settingsSource.match(
      /value: "(?:top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right)"/g,
    )?.length,
    9,
  );
  assert.equal(settingsSource.match(/value: "(?:small|medium|large)"/g)?.length, 3);
  assert.match(indicatorSource, /settings\.subOffsetIndicatorPosition/);
  assert.match(indicatorSource, /settings\.subOffsetIndicatorSize/);
});
