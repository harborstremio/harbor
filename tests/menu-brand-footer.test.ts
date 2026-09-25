import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { HarborMark } from "../src/components/icons/harbor-mark.tsx";

test("root branding uses the real mark, preserves custom assets, and adds no command", async () => {
  const dom = new JSDOM("<div id='root'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  let logo: { mark: string | null; wordmark: string | null } = { mark: null, wordmark: null };
  const code = ts.transpileModule(
    readFileSync(
      new URL("../src/components/context-menu/menu-brand-footer.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/components/icons/harbor-mark": { HarborMark },
    "@/lib/harbor-logo": { useHarborLogo: () => logo },
    "./menu-brand-footer.css": {},
  };
  const module = { exports: {} as { MenuBrandFooter: React.ComponentType } };
  new Function("require", "module", "exports", code)(
    (name: keyof typeof dependencies) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    module,
    module.exports,
  );
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const render = () =>
    React.act(() => root.render(React.createElement(module.exports.MenuBrandFooter)));
  try {
    await render();
    const footer = document.querySelector("[data-context-brand-footer]")!;
    assert.equal(footer.getAttribute("aria-hidden"), "true");
    assert.equal(footer.querySelector("svg")?.getAttribute("viewBox"), "0 0 700 642.88");
    assert.equal(footer.textContent, "");
    assert.equal(footer.querySelector("button,a,[tabindex],[role^='menuitem']"), null);
    logo = {
      mark: "data:image/svg+xml,fixture-colored-mark",
      wordmark: "data:image/svg+xml,fixture-wordmark",
    };
    await render();
    const imgs = footer.querySelectorAll("img");
    assert.equal(imgs.length, 2);
    assert.equal(imgs[0].getAttribute("src"), logo.mark);
    assert.equal(imgs[1].getAttribute("src"), logo.wordmark);
    for (const img of imgs) {
      assert.equal(img.alt, "");
      assert.equal(img.draggable, false);
      assert.equal(img.style.filter, "");
      assert.equal(img.style.maskImage, "");
    }
    await React.act(() => imgs[0].dispatchEvent(new dom.window.Event("error")));
    assert.ok(footer.querySelector("svg"));
    assert.equal(footer.querySelectorAll("img").length, 1);
    logo = { mark: "data:image/svg+xml,next-fixture-mark", wordmark: null };
    await render();
    assert.equal(footer.querySelector("svg"), null);
    assert.equal(footer.querySelector("img")?.getAttribute("src"), logo.mark);
  } finally {
    await React.act(() => root.unmount());
    dom.window.close();
  }
});
