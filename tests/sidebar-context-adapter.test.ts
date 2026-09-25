import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { dispatchTvNav } from "../src/lib/keyboard-navigation.ts";
import {
  MenuSurface,
  menuItemClass,
  useMenuExecution,
} from "../src/components/context-menu/menu-surface.tsx";
import { ActionItems, MenuIcon } from "../src/components/context-menu/action-items.tsx";
import { CreateListModal } from "../src/components/lists/create-list-modal.tsx";
import { ContextImageViewer } from "../src/components/context-image-viewer.tsx";

function navItems(target: { onOpen?: () => void }, close: () => void) {
  const source = readFileSync(
    new URL("../src/components/context-menu.tsx", import.meta.url),
    "utf8",
  );
  const file = ts.createSourceFile(
    "context-menu.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let branch: ts.Statement | undefined;
  let item: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isIfStatement(node) && node.expression.getText(file) === 'state.target.kind === "nav"')
      branch = node.thenStatement;
    if (ts.isFunctionDeclaration(node) && node.name?.text === "Item") item = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(branch && item, "test uses the current production navigation branch and Item");
  const code = ts.transpileModule(
    `${item.getText(file)}\nexport function build() { const items = []; ${branch.getText(file)}; return items; }`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const empty = () => null;
  const scope = {
    useRef: React.useRef,
    useState: React.useState,
    useMenuExecution,
    menuItemClass,
    MenuIcon,
    translate: (text: string) => text,
    t: (text: string) => text,
    state: { target: { kind: "nav", itemId: "settings", ...target } },
    NAV_ITEMS: [{ id: "settings" }],
    effectiveNavOrder: () => ["settings"],
    appSettings: { navCustomization: { order: [], hidden: [], renamed: {} } },
    navEditing: false,
    setNavEditMode() {},
    commitNav() {},
    toggleNavHidden() {},
    moveNavItem() {},
    resetNavCustomization() {},
    Info: empty,
    EyeOff: empty,
    ArrowUp: empty,
    ArrowDown: empty,
    Pencil: empty,
    Eye: empty,
    RotateCcw: empty,
    close,
  };
  const exports: any = {};
  new Function("require", "exports", ...Object.keys(scope), code)(
    (id: string) => {
      assert.equal(id, "react/jsx-runtime");
      return jsxRuntime;
    },
    exports,
    ...Object.values(scope),
  );
  return exports.build();
}

async function fixture(run: (h: any) => Promise<void>) {
  const dom = new JSDOM("<body><button id='origin'>Settings</button><div id='app'></div></body>", {
    url: "http://localhost/",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    localStorage: dom.window.localStorage,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    innerWidth: 800,
    innerHeight: 600,
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  window.matchMedia = (() => ({ matches: true })) as typeof window.matchMedia;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
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
  const root = createRoot(document.getElementById("app")!);
  const origin = document.getElementById("origin")!;
  const remote = (action: Parameters<typeof dispatchTvNav>[0], repeat = false) =>
    React.act(async () => {
      dispatchTvNav(action, repeat);
      // Reduced-motion submenu dismissal completes on its next timer task.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  const render = (children: React.ReactNode, onClose: () => void) =>
    React.act(() =>
      root.render(React.createElement(MenuSurface, { point: { x: 20, y: 20 }, onClose, children })),
    );
  try {
    await run({ dom, root, origin, remote, render });
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
}

test("shared nav menu keeps checked Open, remote focus/activation, repeat protection and Back close", async () =>
  fixture(async (h) => {
    let checkedOpens = 0;
    let closes = 0;
    const close = () => {
      closes++;
      h.root.render(null);
      h.origin.focus();
    };
    const open = () =>
      h.render(
        navItems(
          {
            onOpen: () => {
              checkedOpens++;
            },
          },
          close,
        ),
        close,
      );
    await open();
    assert.equal(document.activeElement?.textContent, "Open");
    assert.equal(checkedOpens, 0, "focus never activates navigation");
    await h.remote("down");
    assert.equal(document.activeElement?.textContent, "Hide this tab");
    await h.remote("up");
    await h.remote("select", true);
    assert.equal(checkedOpens, 0);
    await h.remote("select");
    assert.equal(
      checkedOpens,
      1,
      "remote Select invokes the supplied PIN-checked action exactly once",
    );
    assert.equal(closes, 1);
    assert.equal(document.activeElement, h.origin);
    await open();
    await h.remote("back");
    assert.equal(closes, 2);
    assert.equal(checkedOpens, 1);
    assert.equal(document.activeElement, h.origin);
    await h.render(navItems({}, close), close);
    assert.equal(
      document.activeElement?.textContent,
      "Hide this tab",
      "missing checked callback disables Open and autofocus skips it",
    );
  }));

test("remote search activation and Back stay with the nearest submenu or editor", async () =>
  fixture(async (h) => {
    let closes = 0;
    let dialogCloses = 0;
    const source = {
      actions: () => [
        {
          id: "destinations",
          label: "Destinations",
          searchable: true,
          children: [{ id: "first", label: "First", run() {} }],
        },
      ],
    };
    await h.render(React.createElement(ActionItems, { source, onClose() {} }), () => {
      closes++;
    });
    await h.remote("right");
    const search = document.querySelector<HTMLInputElement>("[data-context-search]")!;
    assert.equal(document.activeElement, search);
    assert.equal(search.readOnly, true);
    await h.remote("select");
    assert.equal(search.readOnly, false, "Select explicitly activates search editing");
    await h.remote("back");
    assert.equal(closes, 0);
    assert.equal((document.activeElement as HTMLElement).dataset.contextAction, "destinations");
    await h.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ActionItems, { source, onClose() {} }),
        React.createElement(CreateListModal, {
          contextLayer: true,
          onClose: () => {
            dialogCloses++;
          },
          store: { useLists: () => [], createList: () => "fixture" } as any,
        }),
      ),
      () => {
        closes++;
      },
    );
    assert.ok(document.activeElement?.closest("[role='dialog']"));
    const cancel = document.querySelector<HTMLButtonElement>(
      "[role='dialog'] button[type='button']",
    )!;
    await React.act(() => cancel.focus());
    await h.remote("select", true);
    assert.equal(dialogCloses, 0, "held Select never activates the editor button");
    await h.remote("select");
    assert.equal(dialogCloses, 1, "Select activates only the nearest editor's Cancel button");
    assert.equal(closes, 0);
    await h.remote("back");
    assert.equal(dialogCloses, 2);
    assert.equal(closes, 0, "editor Back never closes its parent menu");
  }));

test("remote Select and Back preserve the real image viewer and a menu above it", async () =>
  fixture(async (h) => {
    let viewerCloses = 0;
    let menuCloses = 0;
    const image = {
      src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      label: "Fixture",
    };
    const render = (withMenu: boolean) =>
      React.act(async () =>
        h.root.render(
          React.createElement(
            React.Fragment,
            null,
            React.createElement(ContextImageViewer, {
              image,
              onClose: () => {
                viewerCloses++;
              },
              returnFocus: h.origin,
            }),
            withMenu &&
              React.createElement(MenuSurface, {
                point: { x: 20, y: 20 },
                onClose: () => {
                  menuCloses++;
                },
                children: React.createElement("button", { role: "menuitem" }, "Menu command"),
              }),
          ),
        ),
      );
    await render(false);
    const zoom = document.querySelector<HTMLButtonElement>("[aria-label='Zoom in']")!;
    assert.equal(zoom.disabled, false, "the actual inline image loader enables viewer controls");
    await React.act(() => zoom.focus());
    await h.remote("select", true);
    assert.equal(document.querySelector("[aria-live='polite']")?.textContent, "100%");
    await h.remote("select");
    assert.equal(document.querySelector("[aria-live='polite']")?.textContent, "125%");
    const shown = document.querySelector<HTMLImageElement>("[data-harbor-image-viewer] img")!;
    Object.defineProperty(shown, "offsetWidth", { value: 800 });
    await h.remote("right");
    assert.equal(
      shown.style.transform,
      "translate(-40px, 0px) scale(1.25)",
      "arrows remain owned by viewer pan",
    );
    await render(true);
    await h.remote("back");
    assert.equal(menuCloses, 1);
    assert.equal(viewerCloses, 0, "menu Back does not also close the underlying viewer");
    await render(false);
    await React.act(() =>
      document
        .querySelector<HTMLButtonElement>("[data-harbor-image-viewer] [aria-label='Close']")!
        .focus(),
    );
    await h.remote("select");
    assert.equal(viewerCloses, 1, "Select invokes the viewer Close button");
    await h.remote("back");
    assert.equal(viewerCloses, 2);
  }));
