import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MenuSurface } from "../src/components/context-menu/menu-surface.tsx";
import { ActionItems } from "../src/components/context-menu/action-items.tsx";

test("initial focus and a stationary pointer do not reveal last-playback details; exploration does", async () => {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    innerWidth: 800,
    innerHeight: 600,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.matchMedia = (() => ({ matches: true })) as typeof window.matchMedia;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 20,
    y: 80,
    top: 80,
    left: 20,
    right: 260,
    bottom: 180,
    width: 240,
    height: 100,
    toJSON() {},
  });
  const root = createRoot(document.querySelector("#root")!);
  let generation = 1;
  const render = (phase: "open" | "closing" = "open") =>
    act(() =>
      root.render(
        createElement(MenuSurface, {
          key: generation,
          point: { x: 20, y: 80 },
          phase,
          onClose() {},
          children: createElement(ActionItems, {
            source: {
              actions: () => [
                {
                  id: `playback:last:${generation}`,
                  label: "Continue last watched",
                  reason: `Title ${generation}`,
                  tooltipIntent: "deliberate" as const,
                  run() {},
                },
                { id: "other", label: "Other command", run() {} },
              ],
            },
            onClose() {},
          }),
        }),
      ),
    );
  const wait = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 290));
    });
  const button = () =>
    document.querySelector<HTMLButtonElement>("[data-context-action^='playback:last']")!;
  const key = (value: string) =>
    act(() =>
      document.activeElement!.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
      ),
    );
  try {
    await render();
    assert.equal(
      document.activeElement === button(),
      true,
      "primary command still receives initial focus",
    );
    await wait();
    assert.equal(
      document.querySelector("[role='tooltip']")?.textContent ?? null,
      null,
      "initial focus is not exploration",
    );
    await act(() =>
      button().dispatchEvent(
        new dom.window.MouseEvent("mouseover", { bubbles: true, clientX: 30, clientY: 90 }),
      ),
    );
    await wait();
    assert.equal(
      document.querySelector("[role='tooltip']")?.textContent ?? null,
      null,
      "a mounted menu under a still pointer is not a hover request",
    );
    await act(() =>
      button().dispatchEvent(
        new dom.window.MouseEvent("mousemove", { bubbles: true, clientX: 35, clientY: 93 }),
      ),
    );
    await wait();
    assert.equal(document.querySelector("[role='tooltip']")?.textContent, "Title 1");
    await key("ArrowDown");
    assert.equal(document.querySelector("[role='tooltip']"), null);
    await key("ArrowUp");
    await wait();
    assert.equal(
      document.querySelector("[role='tooltip']")?.textContent,
      "Title 1",
      "intentional keyboard focus retains descriptions",
    );
    assert.equal(button().getAttribute("title"), null, "no native duplicate tooltip");
    await render("closing");
    assert.equal(document.querySelector("[role='tooltip']"), null);
    generation++;
    await render();
    await key("ArrowDown");
    await key("ArrowUp");
    generation++;
    await render();
    await wait();
    assert.equal(
      document.querySelector("[role='tooltip']"),
      null,
      "an old focus timer cannot annotate a new menu",
    );
    await key("Home");
    await wait();
    assert.equal(
      document.querySelector("[role='tooltip']")?.textContent,
      "Title 3",
      "intentional navigation to an already focused row works",
    );
  } finally {
    await act(() => root.unmount());
    dom.window.close();
  }
});
