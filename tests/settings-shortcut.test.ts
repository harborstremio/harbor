// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
import arSettings from "../src/lib/i18n/locales/ar/settings.ts";
import ptSettings from "../src/lib/i18n/locales/pt/settings.ts";
import ruSettings from "../src/lib/i18n/locales/ru/settings.ts";
import { HOTKEYS, findHotkeyMatch, shouldHandleGlobalKeyboardEvent } from "../src/lib/hotkeys.ts";

function keyboardEvent(key: string, init: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...init,
  } as KeyboardEvent;
}

test("open settings is a configurable Global Ctrl+S command", () => {
  const command = HOTKEYS.find((entry) => entry.id === "globalSettingsOpen");
  assert.deepEqual(command, {
    id: "globalSettingsOpen",
    scope: "Global",
    group: "Navigation",
    label: "Open settings",
    description: "Open Harbor's settings outside playback.",
    defaultBinding: "ctrl+s",
  });
});

test("open settings follows Global priority and effective binding rules", () => {
  const ctrlS = keyboardEvent("s", { ctrlKey: true });
  const ctrlShiftS = keyboardEvent("S", { ctrlKey: true, shiftKey: true });
  const metaS = keyboardEvent("s", { metaKey: true });
  const altP = keyboardEvent("p", { altKey: true });

  assert.equal(findHotkeyMatch(ctrlS, {}, "Global"), "globalSettingsOpen");
  assert.equal(findHotkeyMatch(ctrlShiftS, {}, "Global"), "globalSettingsOpen");
  assert.equal(findHotkeyMatch(metaS, {}, "Global"), null);
  assert.equal(
    findHotkeyMatch(ctrlS, { globalSearchFocus: "ctrl+s" }, "Global"),
    "globalSearchFocus",
  );
  assert.equal(
    findHotkeyMatch(altP, { globalSettingsOpen: "alt+p" }, "Global"),
    "globalSettingsOpen",
  );
  assert.equal(findHotkeyMatch(ctrlS, { globalSettingsOpen: "alt+p" }, "Global"), null);
});

test("supported catalogs translate the open-settings description", () => {
  const source = "Open Harbor's settings outside playback.";
  for (const [locale, catalog] of [
    ["ar", arSettings],
    ["pt", ptSettings],
    ["ru", ruSettings],
  ] as const) {
    assert.equal(typeof catalog[source], "string", locale);
    assert.notEqual(catalog[source]?.trim(), "", locale);
    assert.notEqual(catalog[source], source, locale);
  }
});

function effectContaining(source: string, needle: string): string {
  const needleAt = source.indexOf(needle);
  assert.notEqual(needleAt, -1, "expected Shell effect marker");
  const start = source.lastIndexOf("  useEffect(() => {", needleAt);
  const end = source.indexOf("\n  useEffect(() => {", needleAt);
  assert.notEqual(start, -1, "expected Shell effect start");
  assert.notEqual(end, -1, "expected Shell effect end");
  return source.slice(start, end);
}

test("typing targets retain ownership of the global shortcut", () => {
  const input = {
    nodeType: 1,
    tagName: "INPUT",
    isContentEditable: false,
    getAttribute: () => null,
  };
  const event = keyboardEvent("s", {
    ctrlKey: true,
    target: input as unknown as EventTarget,
    isComposing: false,
  });
  assert.equal(shouldHandleGlobalKeyboardEvent(event), false);
});

test("Shell consumes save before playback guards and navigates only outside playback", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const effect = effectContaining(app, '"globalSettingsOpen"');
  const order = [
    effect.indexOf("shouldHandleGlobalKeyboardEvent(e)"),
    effect.indexOf('"globalSettingsOpen"'),
    effect.indexOf("e.preventDefault();"),
    effect.indexOf("player ||"),
    effect.indexOf("document.querySelector('[data-harbor-multiview-active=\"true\"]')"),
    effect.indexOf("e.stopPropagation();"),
    effect.indexOf("if (e.repeat) return;"),
    effect.indexOf("openSettings();"),
  ];

  assert.equal(
    order.every((index) => index >= 0),
    true,
    order.join(","),
  );
  assert.equal(
    order.every((index, position) => position === 0 || order[position - 1] < index),
    true,
    order.join(","),
  );
  assert.match(effect, /window\.addEventListener\("keydown", onKey, true\);/);
  assert.match(effect, /window\.removeEventListener\("keydown", onKey, true\);/);
  assert.match(effect, /\[openSettings, player, settings\.hotkeys\]/);
});

test("Shell defers implicit zoom aliases owned by a Settings rebind", () => {
  const settingsRebind = keyboardEvent("=", { metaKey: true });
  assert.equal(
    findHotkeyMatch(settingsRebind, { globalSettingsOpen: "meta+=" }, "Global"),
    "globalSettingsOpen",
  );

  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const effect = effectContaining(app, "const isDefaultUiScaleUp");
  const guard = effect.indexOf('findHotkeyMatch(e, overrides, "Global")');
  const implicitAlias = effect.indexOf("isDefaultUiScaleUp(e)");

  assert.ok(guard >= 0, "expected UI-scale Global ownership guard");
  assert.ok(guard < implicitAlias, "expected the guard before implicit zoom alias matching");
  assert.match(
    effect,
    /globalMatch !== "globalUiScaleUp"[\s\S]*globalMatch !== "globalUiScaleDown"[\s\S]*globalMatch !== "globalUiScaleReset"/,
  );
});

test("Multiview marks only its active mounted root", () => {
  const multiview = readFileSync(new URL("../src/views/multiview.tsx", import.meta.url), "utf8");
  assert.match(multiview, /data-harbor-multiview-active=\{active \? "true" : undefined\}/);
});
