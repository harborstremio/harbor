import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { act, createElement, Fragment } from "react";
import { MenuSurface, useMenuExecution } from "../src/components/context-menu/menu-surface.tsx";
import { ActionItems, QuickActions } from "../src/components/context-menu/action-items.tsx";
import { CreateListModal } from "../src/components/lists/create-list-modal.tsx";

test("quick navigation, closing guards, and destination search preserve keyboard behavior", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>");
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
  let reducedMotion = true;
  dom.window.matchMedia = (() => ({ matches: reducedMotion })) as typeof dom.window.matchMedia;
  // JSDOM has no Web Animations API. Model its asynchronous finish/cancel
  // contract so reopening is tested during an actual exit, not after the
  // production no-animation fallback has already disposed the submenu.
  const animations: { onfinish: (() => void) | null; cancel(): void }[] = [];
  dom.window.HTMLElement.prototype.animate = ((_frames, options) => {
    const duration = typeof options === "number" ? options : Number(options?.duration ?? 0);
    const animation = {
      onfinish: null as (() => void) | null,
      cancel: () => dom.window.clearTimeout(timer),
    };
    const timer = dom.window.setTimeout(() => animation.onfinish?.(), duration);
    animations.push(animation);
    return animation as unknown as Animation;
  }) as typeof dom.window.HTMLElement.prototype.animate;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const nativeFocus = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function (options) {
    // JSDOM otherwise focuses hidden nodes, unlike the browser/WebView. The
    // submenu is deliberately hidden until its collision measurement finishes.
    if (this.style.visibility === "hidden") return;
    for (let node = this.parentElement; node; node = node.parentElement) {
      if (node.style.visibility === "hidden") return;
    }
    nativeFocus.call(this, options);
  };
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 10,
    y: 10,
    top: 10,
    left: 10,
    right: 230,
    bottom: 110,
    width: 220,
    height: 100,
    toJSON() {},
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  let execution: ReturnType<typeof useMenuExecution>;
  const closes: boolean[] = [];
  function Commands() {
    execution = useMenuExecution();
    return createElement("button", { role: "menuitem", id: "primary" }, "Open");
  }
  const button = (id: string) => createElement("button", { role: "menuitem", id, key: id }, id);
  const render = (phase: "open" | "closing") =>
    createElement(MenuSurface, {
      point: { x: 20, y: 20 },
      phase,
      onClose: (restore?: boolean) => {
        closes.push(restore === true);
      },
      quickActions: createElement(
        "div",
        { "data-context-quick": true },
        button("back"),
        button("copy"),
        button("settings"),
      ),
      children: createElement(Commands),
    });
  const key = async (value: string) =>
    act(() => {
      document.activeElement!.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }),
      );
    });
  try {
    await act(() => root.render(render("open")));
    assert.equal(document.activeElement?.id, "primary", "opening prioritizes the primary command");
    await key("ArrowUp");
    assert.equal(document.activeElement?.id, "settings");
    await key("ArrowRight");
    assert.equal(
      document.activeElement?.id,
      "back",
      "horizontal navigation wraps within the strip",
    );
    document.documentElement.style.direction = "rtl";
    (document.getElementById("back")!.parentElement as HTMLElement).style.direction = "rtl";
    await key("ArrowRight");
    assert.equal(
      document.activeElement?.id,
      "settings",
      "RTL reverses visual horizontal direction",
    );
    await key("ArrowDown");
    assert.equal(document.activeElement?.id, "primary");
    await key("Tab");
    assert.deepEqual(closes, [true]);
    await act(() => root.render(render("closing")));
    assert.equal(execution!.acquire(), false, "closing menus cannot run another action");
    let runs = 0;
    const source = {
      actions: () => [
        {
          id: "destinations",
          label: "Destinations",
          searchable: true,
          children: [
            {
              id: "alpha",
              label: "Alpha",
              run: () => {
                runs++;
              },
            },
            {
              id: "beta",
              label: "Beta",
              run: () => {
                runs++;
              },
            },
            {
              id: "create",
              label: "Create new list",
              group: "create",
              run: () => {
                runs++;
              },
            },
          ],
        },
      ],
    };
    document.documentElement.style.direction = "ltr";
    await act(() =>
      root.render(
        createElement(MenuSurface, {
          point: { x: 20, y: 20 },
          onClose() {},
          children: createElement(ActionItems, { source, onClose() {} }),
        }),
      ),
    );
    document.querySelector<HTMLButtonElement>("[data-context-action='destinations']")!.focus();
    await key("ArrowRight");
    const destinationPanel = document.querySelector<HTMLElement>("[data-context-submenu]")!;
    assert.equal(
      destinationPanel.dataset.menuPositioned,
      "true",
      "submenu is placed before its reveal starts",
    );
    assert.equal(destinationPanel.style.getPropertyValue("--context-menu-reveal-origin"), "0%");
    const search = document.querySelector<HTMLInputElement>("[data-context-search]")!;
    assert.equal(
      document.activeElement?.hasAttribute("data-context-search"),
      true,
      "keyboard opening focuses the submenu after placement",
    );
    assert.equal(search.readOnly, true, "remote focus does not begin editing");
    await act(() => {
      window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Enter", cancelable: true }),
      );
    });
    assert.equal(search.readOnly, false, "window-dispatched remote activation begins editing");
    await act(() => {
      document.querySelector<HTMLButtonElement>("[data-context-action='alpha']")!.focus();
    });
    await act(() => {
      search.focus();
    });
    assert.equal(search.readOnly, true, "returning focus requires explicit activation again");
    await key("b");
    assert.equal(search.readOnly, false, "explicit typing activates editing");
    assert.equal(search.value, "b");
    assert.equal(
      document.querySelector("[data-context-submenu]"),
      destinationPanel,
      "filtering preserves the opening's menu surface",
    );
    assert.equal(document.querySelector("[data-context-action='alpha']"), null);
    assert.ok(document.querySelector("[data-context-action='beta']"));
    assert.ok(
      document.querySelector("[data-context-action='create']"),
      "creation remains available under filtering",
    );
    assert.equal(runs, 0, "filtering never activates a destination");
    await key("ArrowDown");
    assert.equal((document.activeElement as HTMLElement).dataset.contextAction, "beta");
    await act(() => window.dispatchEvent(new dom.window.Event("resize")));
    assert.equal(
      (document.activeElement as HTMLElement).dataset.contextAction,
      "beta",
      "remeasurement does not restart autofocus",
    );
    reducedMotion = false;
    await key("Escape");
    const interruptedExit = animations.at(-1)?.onfinish;
    assert.ok(interruptedExit, "normal motion retains the submenu until exit completion");
    assert.equal((document.activeElement as HTMLElement).dataset.contextAction, "destinations");
    await key("ArrowRight");
    await act(async () => {
      interruptedExit();
      await new Promise((resolve) => setTimeout(resolve, 140));
    });
    assert.equal(
      document.querySelector("[data-context-submenu]") === destinationPanel,
      true,
      "reopening cancels the old closing callback",
    );
    assert.equal(document.activeElement?.hasAttribute("data-context-search"), true);
    await key("Escape");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 140));
    });
    assert.equal(document.querySelector("[data-context-submenu]"), null);
    assert.ok(document.querySelector("[role='menu']"), "submenu Escape preserves its root menu");
    reducedMotion = true;
    const quickSource = {
      actions: () => [
        { id: "back", label: "Back", run() {} },
        { id: "copy-image", label: "Copy image", run() {} },
        { id: "settings", label: "Settings", run() {} },
      ],
    };
    await act(() =>
      root.render(
        createElement(MenuSurface, {
          point: { x: 20, y: 20 },
          onClose() {},
          quickActions: createElement(QuickActions, { source: quickSource, onClose() {} }),
          children: createElement(Commands),
        }),
      ),
    );
    assert.deepEqual(
      Array.from(
        document.querySelectorAll(".context-menu-quick-label"),
        (label) => label.textContent,
      ),
      ["Back", "Copy image", "Settings"],
      "quick actions expose their exact payload in visible label elements",
    );
    assert.equal(
      document.querySelector("[data-context-action][title]"),
      null,
      "quick actions do not create duplicate native tooltips",
    );
    assert.ok(document.querySelector(".context-menu-icon[aria-hidden='true']"));
    const settings = document.querySelector<HTMLButtonElement>("[data-context-action='settings']")!;
    await act(() => settings.focus());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 280));
    });
    const settingsTip = document.querySelector<HTMLElement>("[role='tooltip']")!;
    assert.equal(settingsTip.textContent, "Settings");
    assert.equal(settings.getAttribute("aria-describedby"), settingsTip.id);
    const tipLayer = settingsTip.closest<HTMLElement>("[data-harbor-context-layer]")!;
    assert.equal(
      tipLayer.parentElement,
      document.body,
      "tooltip escapes the scrolling menu surface",
    );
    assert.equal(tipLayer.style.zIndex, "2147482100", "tooltip appears above both menu levels");
    await act(() => window.dispatchEvent(new dom.window.Event("scroll")));
    assert.equal(
      document.querySelector("[role='tooltip']"),
      null,
      "menu scrolling removes a stale tooltip",
    );
    const outside = document.createElement("button");
    document.body.append(outside);
    let outsideClicks = 0;
    outside.addEventListener("click", () => {
      outsideClicks++;
    });
    const pointer = (target: Element, type: string, pointerId = 1) => {
      const event = new dom.window.MouseEvent(type, {
        button: 0,
        detail: 1,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "pointerId", { value: pointerId });
      target.dispatchEvent(event);
    };
    const renderDismissible = (key: string) =>
      root.render(
        createElement(MenuSurface, {
          key,
          point: { x: 20, y: 20 },
          onClose: () => root.render(null),
          children: createElement(Commands),
        }),
      );
    await act(() => renderDismissible("held"));
    await act(() => pointer(outside, "pointerdown"));
    await new Promise((resolve) => setTimeout(resolve, 450));
    pointer(outside, "pointerup");
    pointer(outside, "click");
    assert.equal(outsideClicks, 0, "a long-held dismissal remains consumed through release");
    await act(() => renderDismissible("old"));
    await act(() => pointer(outside, "pointerdown"));
    await act(() => renderDismissible("replacement"));
    pointer(outside, "pointerup");
    pointer(outside, "click");
    assert.equal(outsideClicks, 0, "the old held gesture remains consumed after replacement");
    assert.ok(
      document.querySelector("[data-harbor-menu-panel]"),
      "old release cannot dismiss the new menu",
    );
    const replacementItem = document.querySelector("[role='menuitem']")!;
    let replacementClicks = 0;
    replacementItem.addEventListener("click", () => {
      replacementClicks++;
    });
    pointer(replacementItem, "pointerdown");
    pointer(replacementItem, "pointerup");
    pointer(replacementItem, "click");
    assert.equal(replacementClicks, 1, "the replacement's next gesture remains interactive");
    await act(() => pointer(outside, "pointerdown"));
    pointer(outside, "pointercancel");
    await act(() => renderDismissible("after-cancel"));
    let cancelledGestureClicks = 0;
    const afterCancel = document.querySelector("[role='menuitem']")!;
    afterCancel.addEventListener("click", () => {
      cancelledGestureClicks++;
    });
    pointer(afterCancel, "pointerdown");
    pointer(afterCancel, "pointerup");
    pointer(afterCancel, "click");
    assert.equal(cancelledGestureClicks, 1, "pointer cancellation removes the old gesture guard");
    await act(() => pointer(outside, "pointerdown"));
    pointer(outside, "pointerup");
    await act(() => renderDismissible("missing-click"));
    const afterMissingClick = document.querySelector("[role='menuitem']")!;
    let nextGestureClicks = 0;
    afterMissingClick.addEventListener("click", () => {
      nextGestureClicks++;
    });
    pointer(afterMissingClick, "pointerdown");
    pointer(afterMissingClick, "pointerup");
    pointer(afterMissingClick, "click");
    assert.equal(nextGestureClicks, 1, "a new gesture cleans up a release that produced no click");
    let dialogCloses = 0;
    let menuCloses = 0;
    const renderDialog = (visible: boolean) =>
      root.render(
        createElement(MenuSurface, {
          key: "dialog-owner",
          point: { x: 20, y: 20 },
          onClose: () => {
            menuCloses++;
          },
          children: createElement(
            Fragment,
            null,
            createElement(Commands),
            visible &&
              createElement(CreateListModal, {
                contextLayer: true,
                onClose: () => {
                  dialogCloses++;
                  renderDialog(false);
                },
              }),
          ),
        }),
      );
    await act(() => renderDialog(false));
    await act(() => renderDialog(true));
    assert.ok(
      document.activeElement?.closest("[role='dialog']"),
      "the real create dialog owns focus",
    );
    await key("Escape");
    assert.equal(dialogCloses, 1, "keyboard Escape closes the nearest real create dialog once");
    assert.equal(menuCloses, 0, "the parent menu does not intercept dialog Escape");
    assert.ok(document.querySelector("[role='menu']"));
    assert.equal(document.querySelector("[role='dialog']"), null);
    await act(() => renderDialog(true));
    await act(() => {
      window.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
      );
    });
    assert.equal(dialogCloses, 2, "window-dispatched remote Escape also closes only the dialog");
    assert.equal(menuCloses, 0);
  } finally {
    await act(() => root.unmount());
    for (const animation of animations) animation.cancel();
    dom.window.close();
  }
});
