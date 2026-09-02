// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const at = (path: string) => new URL(`../${path}`, import.meta.url);

test("source mode stays reachable before either picker layout renders", () => {
  const picker = readFileSync(at("src/views/play-picker.tsx"), "utf8");
  const toggleMatches = picker.match(/<StreamModeToggle/g) ?? [];
  const toggleAt = picker.indexOf("<StreamModeToggle");
  const layoutBranchAt = picker.indexOf('(settings.pickerLayout === "stremio"');

  assert.equal(toggleMatches.length, 1, "the picker should render one shared source-mode control");
  assert.ok(toggleAt >= 0, "source-mode control is missing");
  assert.ok(layoutBranchAt >= 0, "picker layout branch is missing");
  assert.ok(toggleAt < layoutBranchAt, "source mode must not be hidden inside one layout branch");
});

test("source mode can also be repaired from normal settings", () => {
  const pickerSettings = readFileSync(
    at("src/views/settings/streaming-sources-panel/picker-tab.tsx"),
    "utf8",
  );
  const settingsSearch = readFileSync(at("src/views/settings/nav.tsx"), "utf8");

  assert.match(pickerSettings, /title=\{t\("Source mode"\)\}/);
  assert.match(pickerSettings, /<StreamModeToggle[\s\S]*mode=\{settings\.streamMode\}/);
  assert.match(settingsSearch, /anchorTitle: "Source mode"/);
});

test("source-mode controls describe transport instead of calling every source an addon", () => {
  const toggle = readFileSync(at("src/components/stream-mode-toggle.tsx"), "utf8");
  const switcher = readFileSync(
    at("src/components/player/stream-switcher/filters-menu.tsx"),
    "utf8",
  );
  const bigPicture = readFileSync(at("src/views/big-picture/bp-stream-chips.tsx"), "utf8");

  assert.match(toggle, /label: "Direct\/debrid"/);
  assert.match(switcher, /t\("Direct\/debrid"\)/);
  assert.match(bigPicture, /t\("Direct\/debrid only"\)/);
});
