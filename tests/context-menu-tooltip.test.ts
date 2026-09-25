import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { HoverTooltip } from "../src/components/hover-tooltip.tsx";

test("Harbor menu tooltips preserve fullscreen, focus, and Escape ownership", async () => {
  const dom = new JSDOM("<!doctype html><div id='fullscreen'><div id='root'></div></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const fullscreen = document.getElementById("fullscreen")!;
  Object.defineProperty(document, "fullscreenElement", { value: fullscreen });
  Object.defineProperties(dom.window, { innerWidth: { value: 800 }, innerHeight: { value: 600 } });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 720,
    y: 560,
    top: 560,
    left: 720,
    right: 792,
    bottom: 596,
    width: 72,
    height: 36,
    toJSON() {},
  });
  Object.defineProperties(dom.window.HTMLElement.prototype, {
    offsetWidth: {
      get() {
        return this.getAttribute("role") === "tooltip" ? 120 : 72;
      },
    },
    offsetHeight: {
      get() {
        return this.getAttribute("role") === "tooltip" ? 32 : 36;
      },
    },
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const tick = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  try {
    await act(() =>
      root.render(
        createElement(HoverTooltip, {
          contextMenu: true,
          delayMs: 0,
          label: "Settings",
          align: "center",
          children: createElement(
            "button",
            { id: "settings", "aria-label": "Settings" },
            "Settings",
          ),
        }),
      ),
    );
    const button = document.getElementById("settings")!;
    await act(() => button.focus());
    await tick();
    const tooltip = document.querySelector<HTMLElement>("[role='tooltip']")!;
    assert.ok(tooltip);
    assert.equal(document.activeElement, button, "showing a tooltip never moves focus");
    assert.equal(button.getAttribute("aria-describedby"), tooltip.id);
    const layer = tooltip.closest<HTMLElement>("[data-harbor-context-layer]")!;
    assert.equal(layer.parentElement, fullscreen);
    assert.ok(
      parseFloat(layer.style.top) < 560,
      "tooltip flips above a trigger near the lower edge",
    );
    const escape = new dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    await act(() => button.dispatchEvent(escape));
    assert.equal(
      escape.defaultPrevented,
      false,
      "tooltip dismissal leaves Escape to its owning menu",
    );
    assert.equal(document.querySelector("[role='tooltip']"), null);
    assert.equal(button.getAttribute("aria-describedby"), null);
    await act(() => button.blur());
    await act(() => button.focus());
    await tick();
    assert.ok(document.querySelector("[role='tooltip']"));
    await act(() => button.dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })));
    assert.equal(
      document.querySelector("[role='tooltip']"),
      null,
      "activation removes the tooltip before running the command",
    );
    assert.equal(button.getAttribute("title"), null);
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});
