// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { copyText } from "../src/lib/clipboard-text.ts";

test("native text copy uses the clipboard command and reports failure", async () => {
  const calls: unknown[] = [];
  Object.defineProperty(globalThis, "isTauri", { configurable: true, value: true });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: unknown) => {
          calls.push([command, args]);
        },
      },
    },
  });
  try {
    assert.equal(await copyText("fixture text"), true);
    assert.deepEqual(calls, [["plugin:clipboard-manager|write_text", { text: "fixture text" }]]);
    window.__TAURI_INTERNALS__.invoke = async () => {
      throw new Error("denied");
    };
    assert.equal(await copyText("fixture text"), false);
  } finally {
    delete globalThis.window;
    delete globalThis.isTauri;
  }
});

test("legacy copy cleans up and restores focus and selection even when copy throws", async () => {
  let removed = 0;
  let focused = 0;
  let restored: unknown[] = [];
  const range = {
    cloneRange() {
      return this;
    },
  };
  const selection = {
    rangeCount: 1,
    getRangeAt: () => range,
    removeAllRanges() {},
    addRange(value: unknown) {
      assert.equal(value, range);
    },
  };
  const input = {
    tagName: "INPUT",
    selectionStart: 2,
    selectionEnd: 5,
    selectionDirection: "backward",
    isConnected: true,
    focus() {
      focused++;
    },
    setSelectionRange(...args: unknown[]) {
      restored = args;
    },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      activeElement: input,
      getSelection: () => selection,
      createElement: () => ({
        style: {},
        setAttribute() {},
        select() {},
        remove() {
          removed++;
        },
      }),
      body: { appendChild() {} },
      execCommand() {
        throw new Error("denied");
      },
    },
  });
  try {
    assert.equal(await copyText("fixture text"), false);
    assert.equal(removed, 1);
    assert.equal(focused, 1);
    assert.deepEqual(restored, [2, 5, "backward"]);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});
