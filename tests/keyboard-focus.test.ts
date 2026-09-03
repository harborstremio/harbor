// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { shouldHandleGlobalKeyboardEvent } from "../src/lib/hotkeys.ts";

const navigationSource = readFileSync(
  new URL("../src/lib/keyboard-navigation.ts", import.meta.url),
  "utf8",
);
const searchHotkeySource = readFileSync(
  new URL("../src/components/search/search-hotkey.tsx", import.meta.url),
  "utf8",
);
const topbarSource = readFileSync(new URL("../src/chrome/topbar.tsx", import.meta.url), "utf8");
const royalTopbarSource = readFileSync(
  new URL("../src/chrome/royal-topbar.tsx", import.meta.url),
  "utf8",
);
const settingsNavSource = readFileSync(
  new URL("../src/views/settings/nav.tsx", import.meta.url),
  "utf8",
);
const themeSource = readFileSync(new URL("../src/lib/theme.ts", import.meta.url), "utf8");
const globalStylesSource = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("TV focus waits for navigation intent before applying page defaults", () => {
  assert.match(navigationSource, /let hasTvNavigationIntent = false/);
  assert.match(navigationSource, /if \(!hasTvNavigationIntent\) return/);
  assert.match(navigationSource, /export function moveFocus[\s\S]*?hasTvNavigationIntent = true;/);
});

test("TV focus styling uses one theme-aware ring without hard-coded white layers", () => {
  const injectedStyles = navigationSource.match(/style\.textContent = `([\s\S]*?)`;/)?.[1];

  assert.ok(injectedStyles, "keyboard navigation focus styles must exist");
  assert.match(injectedStyles, /var\(--color-accent\)/);
  assert.doesNotMatch(injectedStyles, /#ffffff|#fff\b/i);
  assert.doesNotMatch(injectedStyles, /0 0 0 8px|0 0 0 9px/);
});

type KeyboardEventOptions = {
  isComposing?: boolean;
  key?: string;
  repeat?: boolean;
  target?: {
    nodeType: number;
    tagName: string;
    isContentEditable?: boolean;
    getAttribute(name: string): string | null;
  };
};

function keyboardEvent(options: KeyboardEventOptions = {}) {
  const event = new Event("keydown") as KeyboardEvent;
  Object.defineProperties(event, {
    isComposing: { value: options.isComposing ?? false },
    key: { value: options.key ?? "x" },
    repeat: { value: options.repeat ?? false },
    target: { value: options.target ?? null },
  });
  return event;
}

function target(
  tagName: string,
  attributes: Record<string, string> = {},
  isContentEditable = false,
) {
  return {
    nodeType: 1,
    tagName,
    isContentEditable,
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
  };
}

function withDocumentFocus(hasFocus: boolean, run: () => void) {
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { hasFocus: () => hasFocus, activeElement: null },
  });
  try {
    run();
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  }
}

test("global keyboard shortcuts ignore text entry, IME, and unfocused windows", () => {
  withDocumentFocus(true, () => {
    assert.equal(
      shouldHandleGlobalKeyboardEvent(keyboardEvent({ target: target("INPUT") })),
      false,
    );
    assert.equal(
      shouldHandleGlobalKeyboardEvent(keyboardEvent({ target: target("TEXTAREA") })),
      false,
    );
    assert.equal(
      shouldHandleGlobalKeyboardEvent(keyboardEvent({ target: target("SELECT") })),
      false,
    );
    assert.equal(
      shouldHandleGlobalKeyboardEvent(keyboardEvent({ target: target("DIV", {}, true) })),
      false,
    );
    assert.equal(
      shouldHandleGlobalKeyboardEvent(
        keyboardEvent({ target: target("DIV", { role: "textbox" }) }),
      ),
      false,
    );
    assert.equal(shouldHandleGlobalKeyboardEvent(keyboardEvent({ isComposing: true })), false);
    assert.equal(shouldHandleGlobalKeyboardEvent(keyboardEvent({ key: "Process" })), false);
    assert.equal(shouldHandleGlobalKeyboardEvent(keyboardEvent({ repeat: true })), true);
  });
  withDocumentFocus(false, () => {
    assert.equal(shouldHandleGlobalKeyboardEvent(keyboardEvent()), false);
  });
});

test("keyboard navigation handles Back before applying the global eligibility guard", () => {
  const backHandler = navigationSource.indexOf("if (isBackKey(e)) {");
  const globalGuard = navigationSource.indexOf("shouldHandleGlobalKeyboardEvent(e)");

  assert.ok(backHandler >= 0, "keyboard navigation must handle Back keys");
  assert.ok(globalGuard > backHandler, "Back handling must precede the global eligibility guard");
});

test("vertical theme nav zones participate in sidebar edge navigation", () => {
  const sidebarHelper = navigationSource.match(
    /function isInSidebar[\s\S]*?function isInTopChrome/,
  )?.[0];

  assert.ok(sidebarHelper, "sidebar classification helper must exist");
  assert.match(sidebarHelper, /data-harbor-sidebar/);
  assert.match(sidebarHelper, /data-tv-nav-zone/);
  assert.match(sidebarHelper, /data-tv-top-chrome/);
  assert.match(themeSource, /<aside class="fsh-rail" data-tv-nav-zone/);
});

test("sidebar entry and exit follow physical position in LTR and RTL", () => {
  const directionHelper = navigationSource.match(
    /function isTargetInHorizontalDirection[\s\S]*?function getActiveModal/,
  )?.[0];
  const moveFocusSource = navigationSource.match(
    /export function moveFocus[\s\S]*?type TVNavigationOptions/,
  )?.[0];

  assert.ok(directionHelper, "horizontal direction helper must exist");
  assert.match(directionHelper, /dir === "left" \? targetX < fromX - 8 : targetX > fromX \+ 8/);

  assert.ok(moveFocusSource, "moveFocus implementation must exist");
  assert.match(
    moveFocusSource,
    /active && horizontalDir && !isInSidebar\(active\) && !isInTopChrome\(active\)/,
  );
  assert.match(
    moveFocusSource,
    /targetNav && isTargetInHorizontalDirection\(active, targetNav, horizontalDir\)/,
  );
  assert.match(
    moveFocusSource,
    /targetContent && isTargetInHorizontalDirection\(active, targetContent, horizontalDir\)/,
  );
  assert.doesNotMatch(moveFocusSource, /dir === "left" && !isInSidebar/);
  assert.doesNotMatch(moveFocusSource, /dir === "right" && isInSidebar/);
});

test("settings search separates navigation focus from explicit text mode", () => {
  assert.match(
    navigationSource,
    /const isNavigatingSearch =[\s\S]*?hasAttribute\("data-search-nav-mode"\)/,
  );
  assert.match(
    navigationSource,
    /if \(!isNavigatingSearch && !shouldHandleGlobalKeyboardEvent\(e\)\) return;/,
  );
  assert.match(
    navigationSource,
    /const onFocusIn =[\s\S]*?closest\("\[data-tv-text-field\]"\)[\s\S]*?focusElement\(field/,
  );
  assert.match(navigationSource, /e\.key === "Escape" && isEditingSearch/);
  assert.match(navigationSource, /e\.key === "Enter"[\s\S]*?e\.code === "Space"/);

  assert.match(settingsNavSource, /data-settings-search-field/);
  assert.match(settingsNavSource, /data-tv-text-field/);
  assert.match(settingsNavSource, /data-settings-search-nav-hint/);
  assert.match(settingsNavSource, /data-settings-search-edit-hint/);
  assert.match(globalStylesSource, /data-tv-search-nav-focused/);
  assert.match(globalStylesSource, /data-tv-search-editing-focused/);
});

test("every global search listener uses the shared keyboard eligibility guard", () => {
  for (const source of [searchHotkeySource, topbarSource, royalTopbarSource]) {
    assert.match(source, /if \(!shouldHandleGlobalKeyboardEvent\(e\)\) return;/);
  }
});
