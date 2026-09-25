import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as ReactDom from "react-dom";
import * as icons from "lucide-react";
import * as lists from "../src/lib/custom-lists.ts";
import * as membership from "../src/lib/membership-operations.ts";

function loader(extra: Record<string, unknown> = {}) {
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsx,
    "react-dom": ReactDom,
    "lucide-react": icons,
    "@/lib/custom-lists": lists,
    "@/lib/membership-operations": membership,
    "@/lib/membership-actions": {
      membershipFailureMessage: (result: { reason: string }) => result.reason,
    },
    "@/lib/i18n": { useT: () => (key: string) => key },
    "@/components/icons/harbor-glyphs": { ShowcaseIcon: () => null },
    "@/components/anchored-menu": {
      AnchoredMenu: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? children : null,
    },
    "@/lib/social/showcase": {
      useShowcaseMetaId: () => null,
      clearShowcase() {},
      setShowcase() {},
    },
    "./list-toast": { emitListToast() {} },
    ...extra,
  };
  const load = (path: string): any => {
    const output = ts.transpileModule(
      readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    const module = { exports: {} };
    new Function("require", "module", "exports", output.outputText)(
      (name: string) => {
        if (name === "./create-list-modal")
          return load("src/components/lists/create-list-modal.tsx");
        assert.ok(Object.hasOwn(deps, name), `Unexpected dependency ${name}`);
        return deps[name];
      },
      module,
      module.exports,
    );
    return module.exports;
  };
  return load;
}

function storageFixture() {
  const values = new Map<string, string>();
  const key = "harbor.customlists.v1.fixture";
  let failed = false;
  let writes = 0;
  const switchProfile = (id: string) =>
    values.set(
      "harbor.profiles.v1",
      JSON.stringify({ activeId: id, profiles: [{ id, settingsLinked: false }] }),
    );
  switchProfile("fixture");
  values.set(key, JSON.stringify([{ id: "kept", name: "Kept", items: [], custom: "preserved" }]));
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (target: string, value: string) => {
        if (target === key) {
          writes++;
          if (failed) throw new Error("fixture write denial");
        }
        values.set(target, value);
      },
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      get length() {
        return values.size;
      },
    },
  });
  return {
    values,
    key,
    switchProfile,
    fail: (value: boolean) => {
      failed = value;
    },
    writes: () => writes,
  };
}

test("shared-list saving persists all items atomically, reports failure, retries and remains idempotent", async () => {
  const h = storageFixture();
  const original = h.values.get(h.key);
  const { saveList } = loader({
    "./featured-lists": {
      fetchSharedList: async () => ({
        name: "Shared fixture",
        items: [
          { id: "tt-a", type: "movie", name: "A" },
          { id: "tt-b", type: "series", name: "B" },
        ],
      }),
    },
  })("src/lib/social/save-list.ts");
  h.fail(true);
  await assert.rejects(saveList("other-user", "source"));
  assert.equal(h.values.get(h.key), original);
  h.fail(false);
  const before = h.writes();
  assert.deepEqual(await saveList("other-user", "source"), { ok: true });
  assert.equal(h.writes() - before, 1, "copying all items is one durable write");
  const saved = JSON.parse(h.values.get(h.key)!);
  assert.equal(saved[0].custom, "preserved");
  assert.deepEqual(
    saved[1].items.map((item: { id: string }) => item.id),
    ["tt-a", "tt-b"],
  );
  assert.deepEqual(await saveList("other-user", "source"), { ok: true, already: true });
  assert.equal(h.writes() - before, 1);
});

test("shared-list copying rejects an actor change while fetching without touching either profile", async () => {
  const h = storageFixture();
  let resolve!: (value: unknown) => void;
  const { saveList } = loader({
    "./featured-lists": {
      fetchSharedList: () =>
        new Promise((done) => {
          resolve = done;
        }),
    },
  })("src/lib/social/save-list.ts");
  const operation = saveList("other-user", "source");
  h.switchProfile("next");
  resolve({ name: "Remote fixture", items: [{ id: "tt-a" }] });
  await assert.rejects(operation);
  assert.equal(h.writes(), 0);
  assert.equal(h.values.has("harbor.customlists.v1.next"), false);
});

test("ordinary Add to list creation keeps failure editable and atomically saves the originally chosen title on retry", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  // React was imported before a browser exists in this Node test process.
  Object.assign(dom.window.HTMLElement.prototype, { attachEvent() {}, detachEvent() {} });
  const h = storageFixture();
  const toasts: string[] = [];
  let closes = 0;
  const { AddToListMenu } = loader({
    "./list-toast": { emitListToast: (text: string) => toasts.push(text) },
  })("src/components/lists/add-to-list-menu.tsx");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const render = (id = "tt-original") =>
    React.act(() =>
      root.render(
        React.createElement(AddToListMenu, {
          item: { id, type: "movie", name: id },
          anchorRef: { current: null },
          open: true,
          onClose: () => closes++,
        }),
      ),
    );
  const button = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === label,
    )!;
  const enterName = async () => {
    const input = document.querySelector<HTMLInputElement>("input")!;
    await React.act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "Created fixture",
      );
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
  };
  const submit = () =>
    React.act(() =>
      document
        .querySelector("form")!
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })),
    );
  try {
    await render();
    await React.act(() => button("Create new list").click());
    await enterName();
    h.fail(true);
    await submit();
    assert.equal(closes, 0);
    assert.ok(document.querySelector("[role=alert]"));
    assert.equal(toasts.length, 0);
    assert.equal(JSON.parse(h.values.get(h.key)!).length, 1);
    await render("tt-replacement");
    h.fail(false);
    await submit();
    assert.equal(closes, 1);
    assert.equal(document.querySelector("form"), null);
    const saved = JSON.parse(h.values.get(h.key)!);
    assert.equal(saved.length, 2);
    assert.deepEqual(
      saved[1].items.map((item: { id: string }) => item.id),
      ["tt-original"],
    );
    const persisted = h.values.get(h.key);
    await React.act(() => button("Create new list").click());
    await React.act(() => button("Cancel").click());
    assert.equal(closes, 2);
    assert.equal(h.values.get(h.key), persisted, "cancel does not create an empty destination");
    await React.act(() => button("Create new list").click());
    await enterName();
    h.switchProfile("next");
    await submit();
    assert.equal(closes, 2, "an actor change keeps the failed creation open");
    assert.ok(document.querySelector("[role=alert]"));
    assert.equal(h.values.get(h.key), persisted);
    assert.equal(h.values.has("harbor.customlists.v1.next"), false);
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
