import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
import { MenuSurface } from "../src/components/context-menu/menu-surface.tsx";
import * as actionItems from "../src/components/context-menu/action-items.tsx";
import { CreateListModal } from "../src/components/lists/create-list-modal.tsx";
import * as lists from "../src/lib/custom-lists.ts";
import * as profile from "../src/lib/membership-operations.ts";

const endpoint = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const hook = registerHooks({
  load(url, context, next) {
    return url === endpoint
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : next(url, context);
  },
});
const membershipActions = await import("../src/lib/membership-actions.ts");
hook.deregister();

// Keep the component, menus, modal and persistence real. The only substituted
// boundaries are translation, decorative artwork and the global toast surface.
function loadControl() {
  const output = ts.transpileModule(
    readFileSync(
      new URL("../src/components/context-menu/my-list-submenu.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/custom-lists": lists,
    "@/lib/membership-operations": profile,
    "@/lib/membership-actions": membershipActions,
    "@/lib/i18n": {
      useT: () => (key, values) =>
        key.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? name)),
    },
    "@/components/lists/list-toast": { emitListToast() {} },
    "@/components/lists/create-list-modal": { CreateListModal },
    "@/components/ui-icon": { UiIcon: () => React.createElement("span", { "data-ui-icon": true }) },
    "./action-items": actionItems,
    "./collection-destination-icon": {
      CollectionDestinationIcon: () =>
        React.createElement("span", { "data-collection-artwork": true }),
    },
  };
  const exports = {};
  new Function("require", "exports", output.outputText)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports.MyListSubmenu;
}

test("membership creation cancels and saves back into the same stable destination chooser", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    innerWidth: 800,
    innerHeight: 600,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.matchMedia = () => ({ matches: true });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 20,
    y: 20,
    top: 20,
    left: 20,
    right: 284,
    bottom: 220,
    width: 264,
    height: 200,
    toJSON() {},
  });
  localStorage.setItem(
    "harbor.profiles.v1",
    JSON.stringify({ activeId: "fixture", profiles: [{ id: "fixture", settingsLinked: false }] }),
  );
  const key = "harbor.customlists.v1.fixture";
  const item = { id: "tt-fixture", name: "Fixture title", type: "movie" };
  localStorage.setItem(key, JSON.stringify([{ id: "existing", name: "Existing", items: [item] }]));
  const MyListSubmenu = loadControl();
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  let closes = 0;
  const render = () =>
    React.createElement(MenuSurface, {
      point: { x: 30, y: 30 },
      onClose: () => closes++,
      children: React.createElement(MyListSubmenu, { item: { ...item }, onClose: () => closes++ }),
    });
  const action = (id) =>
    document.querySelector<HTMLButtonElement>(`[data-context-action='${id}']`)!;
  const click = async (element) =>
    React.act(async () => {
      element.click();
    });
  const settle = async () =>
    React.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  try {
    await React.act(() => root.render(render()));
    await click(action("membership:add"));
    const chooser = document.querySelector("[data-context-submenu]");
    const initial = localStorage.getItem(key);
    await click(action("membership:create-list"));
    assert.ok(document.querySelector("[role='dialog']"));
    const cancel = [...document.querySelectorAll("[role='dialog'] button")].find(
      (button) => button.textContent === "Cancel",
    );
    await click(cancel);
    await settle();
    assert.equal(closes, 0);
    assert.equal(localStorage.getItem(key), initial);
    assert.equal(document.activeElement, action("membership:create-list"));
    assert.equal(document.querySelector("[data-context-submenu]"), chooser);
    await click(action("membership:create-list"));
    const input = document.querySelector<HTMLInputElement>("[role='dialog'] input")!;
    await React.act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "New fixture",
      );
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await React.act(() =>
      document
        .querySelector("form")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
    await settle();
    assert.equal(
      document.querySelector("[role='dialog']"),
      null,
      "successful creation leaves the modal",
    );
    assert.equal(closes, 0, "successful creation retains the menu");
    const stored = JSON.parse(localStorage.getItem(key)!);
    const created = stored.find((list) => list.name === "New fixture");
    assert.ok(created);
    assert.deepEqual(
      created.items.map(({ id }) => id),
      [item.id],
    );
    assert.equal(action(`membership:add:list:${created.id}`).getAttribute("aria-checked"), "true");
    assert.equal(document.activeElement, action(`membership:add:list:${created.id}`));
    await React.act(() => root.render(render()));
    assert.equal(
      document.querySelector("[data-context-submenu]"),
      chooser,
      "harmless parent render retains submenu",
    );
    assert.deepEqual(
      [...chooser!.querySelectorAll("[data-context-action]")]
        .filter((row) =>
          row.getAttribute("data-context-action")!.startsWith("membership:add:list:"),
        )
        .map((row) => row.getAttribute("data-context-action")),
      ["membership:add:list:existing", `membership:add:list:${created.id}`],
    );
    const existingRow = action("membership:add:list:existing");
    await React.act(() => existingRow.focus());
    await click(existingRow);
    assert.equal(existingRow.getAttribute("aria-checked"), "false");
    assert.equal(
      document.activeElement,
      existingRow,
      "removing membership retains the focused row",
    );
    assert.equal(document.querySelector("[data-context-submenu]"), chooser);
    assert.equal(closes, 0);
    assert.deepEqual(JSON.parse(localStorage.getItem(key)!)[0].items, []);
    const persist = dom.window.Storage.prototype.setItem;
    dom.window.Storage.prototype.setItem = function (storageKey, value) {
      if (storageKey === key) throw new DOMException("Full", "QuotaExceededError");
      persist.call(this, storageKey, value);
    };
    await click(existingRow);
    assert.equal(
      existingRow.getAttribute("aria-checked"),
      "false",
      "failed addition never displays a saved checkmark",
    );
    assert.match(document.querySelector("[role='alert']")?.textContent ?? "", /save|storage/i);
    assert.equal(
      action(`membership:add:list:${created.id}`).getAttribute("aria-checked"),
      "true",
      "other saved membership survives",
    );
    dom.window.Storage.prototype.setItem = persist;
    await click(existingRow);
    assert.equal(existingRow.getAttribute("aria-checked"), "true");
    assert.equal(closes, 0);
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
