import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

function loadDestinationIcon() {
  const { outputText } = ts.transpileModule(
    readFileSync(
      new URL("../src/components/context-menu/collection-destination-icon.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/components/icons/nav-glyph": {
      NavGlyph: ({ name, className }: { name: string; className: string }) =>
        React.createElement("span", { "data-nav-glyph": name, className }),
    },
    // The component's behavior under review is artwork selection and load state.
    // No network, account storage, or native image bridge participates in this test.
    "@/lib/remote-image-proxy": { useProxiedImageSrc: (url: string | undefined) => url },
    "@/lib/collections": {
      absCollectionImage: (url: string | undefined) =>
        url?.startsWith("/") ? `https://fixture.invalid${url}` : url,
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: keyof typeof dependencies) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/components/context-menu/collection-destination-icon.tsx");
}

async function fixture() {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const { CollectionDestinationIcon } = loadDestinationIcon();
  const render = async (destination?: { id: string; coverImage?: string; bgImage?: string }) =>
    React.act(() => root.render(React.createElement(CollectionDestinationIcon, { destination })));
  return {
    dom,
    render,
    img: () => document.querySelector<HTMLImageElement>("img"),
    slot: () => document.getElementById("root")!.firstElementChild as HTMLElement,
    close: async () => {
      await React.act(() => root.unmount());
      dom.window.close();
    },
  };
}

test("collection destinations choose designated artwork and keep the original collection fallback", async () => {
  const h = await fixture();
  try {
    await h.render();
    assert.equal(h.img(), null);
    assert.equal(
      h.slot().querySelector("[data-nav-glyph]")?.getAttribute("data-nav-glyph"),
      "collections",
    );
    assert.equal(h.slot().getAttribute("aria-hidden"), "true");
    assert.equal(h.slot().querySelector("[tabindex], button, a"), null);

    await h.render({ id: "cover", coverImage: " /cover.png ", bgImage: "/background.png" });
    assert.equal(h.img()?.src, "https://fixture.invalid/cover.png");
    assert.equal(h.img()?.alt, "");
    assert.equal(h.img()?.draggable, false);

    await h.render({
      id: "background",
      coverImage: "file:///private-cover.png",
      bgImage: "/background.png",
    });
    assert.equal(h.img()?.src, "https://fixture.invalid/background.png");

    await h.render({
      id: "no-artwork",
      coverImage: "javascript:alert(1)",
      bgImage: "relative.png",
    });
    assert.equal(
      h.img(),
      null,
      "unsuitable locations keep a collection glyph instead of loading arbitrary content",
    );
    assert.equal(
      h.slot().querySelector("[data-nav-glyph]")?.getAttribute("data-nav-glyph"),
      "collections",
    );
  } finally {
    await h.close();
  }
});

test("thumbnail load, failure and source replacement preserve a stable nonfocusable icon slot", async () => {
  const h = await fixture();
  try {
    await h.render({ id: "collection", coverImage: "https://fixture.invalid/first.png" });
    const slot = h.slot();
    const originalClasses = slot.className;
    const first = h.img()!;
    assert.ok(slot.classList.contains("size-5"), "the slot reserves its dimensions before loading");
    assert.equal(first.style.opacity, "0");
    assert.ok(slot.querySelector('[data-nav-glyph="collections"]'));
    await React.act(() => first.dispatchEvent(new h.dom.window.Event("load")));
    assert.equal(first.style.opacity, "1");
    assert.equal(h.slot(), slot);
    assert.equal(slot.className, originalClasses);

    await h.render({ id: "collection", coverImage: "https://fixture.invalid/second.png" });
    const second = h.img()!;
    assert.notEqual(second, first);
    assert.equal(
      second.style.opacity,
      "0",
      "the previous image's success must not reveal a new pending image",
    );
    await React.act(() => second.dispatchEvent(new h.dom.window.Event("error")));
    assert.equal(h.img(), null);
    assert.ok(slot.querySelector('[data-nav-glyph="collections"]'));
    assert.equal(h.slot(), slot);
    assert.equal(slot.className, originalClasses);

    await h.render({ id: "collection", coverImage: "https://fixture.invalid/third.png" });
    const third = h.img()!;
    assert.equal(third.style.opacity, "0", "one broken URL does not suppress another source");
    await React.act(() => third.dispatchEvent(new h.dom.window.Event("load")));
    await React.act(() => first.dispatchEvent(new h.dom.window.Event("load")));
    assert.equal(
      third.style.opacity,
      "1",
      "a detached old image cannot replace the current loaded state",
    );
    assert.equal(h.slot(), slot);
    assert.equal(slot.className, originalClasses);
    assert.equal(slot.querySelector("[tabindex], button, a"), null);
  } finally {
    await h.close();
  }
});
