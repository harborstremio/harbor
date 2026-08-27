// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  DEFAULT_SUBTITLE_PANEL_SIZE,
  clampSubtitlePanelSize,
} from "../src/components/player/subtitle-menu/panel-size.ts";
import { marqueeDurationMs } from "../src/components/player/subtitle-menu/marquee-motion.ts";

const resizablePanel = readFileSync(
  new URL("../src/components/player/subtitle-menu/resizable-panel.tsx", import.meta.url),
  "utf8",
);

test("subtitle panel keeps its normal size when the viewport has enough room", () => {
  assert.deepEqual(
    clampSubtitlePanelSize(DEFAULT_SUBTITLE_PANEL_SIZE, { width: 1_920, height: 1_080 }),
    DEFAULT_SUBTITLE_PANEL_SIZE,
  );
});

test("subtitle panel is bounded by the player viewport", () => {
  assert.deepEqual(
    clampSubtitlePanelSize({ width: 2_000, height: 2_000 }, { width: 800, height: 600 }),
    { width: 752, height: 480 },
  );
});

test("subtitle panel can still fit on a viewport smaller than its normal minimum", () => {
  assert.deepEqual(
    clampSubtitlePanelSize({ width: 100, height: 100 }, { width: 360, height: 360 }),
    { width: 312, height: 240 },
  );
});

test("subtitle title marquee stays readable at short and long overflow distances", () => {
  assert.equal(marqueeDurationMs(10), 1_200);
  assert.equal(marqueeDurationMs(1_000), 6_000);
});

test("the caller positioning stays separate from the panel's relative surface", () => {
  assert.match(resizablePanel, /className=\{className\}/);
  assert.match(resizablePanel, /<div className="relative flex h-full w-full/);
  assert.doesNotMatch(resizablePanel, /className=\{`relative[^`]*\$\{className\}`\}/);
});
