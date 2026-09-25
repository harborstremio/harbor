import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import * as actionItems from "../src/components/context-menu/action-items.tsx";
import { focusMenuCommand } from "../src/lib/menu-interaction.ts";
import * as uiIcon from "../src/components/ui-icon.tsx";
import * as presentation from "../src/lib/last-playback-presentation.ts";
import type { ActualPlayback } from "../src/lib/playback-history.ts";

const last: ActualPlayback = {
  id: "actual-a",
  actor: { profileId: "fixture", storageProfileId: "fixture", accountId: null },
  playedAt: 100,
  positionMs: 18000,
  durationMs: 120000,
  completed: false,
  src: {
    meta: {
      id: "tt-fixture-a",
      type: "movie",
      name: "Watched A",
      poster: "https://fixture.invalid/a.jpg",
    },
    url: "C:/synthetic/a.mp4",
    title: "Watched A",
  },
};

async function fixture(target: ActualPlayback | null = last) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "https://fixture.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: clearTimeout,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.matchMedia = (() => ({ matches: true })) as typeof window.matchMedia;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const calls: Array<{ target: ActualPlayback; options: { restart?: boolean } }> = [];
  const state = {
    target,
    pending: false,
    watched: false,
    clicked: "B",
    enabled: true,
    closes: [] as Array<boolean | undefined>,
    run: async () => {},
  };
  // Keep the actual CoverImg element, including DOM load/error behavior, while
  // substituting the settings-dependent network proxy boundary for this fixture.
  const coverImg: any = {};
  const coverCode = ts.transpileModule(
    readFileSync(new URL("../src/components/cover-img.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  new Function("require", "exports", coverCode)((id: string) => {
    if (id === "react/jsx-runtime") return jsxRuntime;
    assert.equal(id, "@/lib/remote-image-proxy");
    return { useProxiedImageSrc: (src: string) => src };
  }, coverImg);
  // Keep the command, shared renderer/confirmation, artwork SVG and spoiler
  // presentation real. Substitute account/history/settings hooks.
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/hooks/use-last-playback-continuation": {
      useLastPlaybackContinuation: () => ({
        target: state.target,
        pending: state.pending,
        continuePlayback: async (selected: ActualPlayback, options: { restart?: boolean }) => {
          calls.push({ target: selected, options });
          await state.run();
        },
      }),
    },
    "@/lib/context-watched-state": {
      useContextWatchedState: () => ({
        summary: { status: state.watched ? "watched" : "unknown" },
      }),
    },
    "@/lib/settings": {
      useSettings: () => ({
        settings: {
          hideSpoilers: true,
          spoilerHideThumbnails: true,
          spoilerHideTitles: true,
          spoilerHideDescriptions: true,
          spoilerSkipNext: true,
        },
      }),
    },
    "@/lib/i18n": { useT: () => (key: string) => key },
    "@/lib/last-playback-presentation": presentation,
    "@/components/ui-icon": uiIcon,
    "@/components/cover-img": coverImg,
    "./action-items": actionItems,
  };
  const source = readFileSync(
    new URL("../src/components/context-menu/last-playback-command.tsx", import.meta.url),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  const root = createRoot(document.querySelector("#root")!);
  const render = () =>
    React.act(async () =>
      root.render(
        React.createElement(
          "div",
          { "data-clicked-title": state.clicked },
          React.createElement(exports.LastPlaybackCommand, {
            enabled: state.enabled,
            onClose: (restore?: boolean) => state.closes.push(restore),
          }),
        ),
      ),
    );
  const action = () => document.querySelector<HTMLButtonElement>("[data-context-action]")!;
  const click = async (selector: string | HTMLElement) => {
    const element =
      typeof selector === "string" ? document.querySelector<HTMLElement>(selector)! : selector;
    assert.ok(element, `Missing target: ${selector}`);
    await React.act(async () => element.click());
  };
  const dispose = async () => {
    await React.act(async () => root.unmount());
    dom.window.close();
  };
  await render();
  return { dom, state, calls, render, action, click, dispose };
}

test("empty actual history renders no last-playback command or separator", async () => {
  const f = await fixture(null);
  try {
    assert.equal(document.querySelector("[data-context-action]"), null);
    assert.equal(document.querySelector("[role='separator']"), null);
  } finally {
    await f.dispose();
  }
});

test("a menu on B continues the actual A target and preserves its payload across rerenders", async () => {
  const f = await fixture();
  try {
    f.state.clicked = "Different B";
    await f.render();
    assert.equal(f.action().textContent?.trim(), "Continue last watched");
    await f.click(f.action());
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].target, last);
    assert.equal(f.calls[0].target.src.url, "C:/synthetic/a.mp4");
    assert.deepEqual(f.calls[0].options, { restart: false });
    assert.deepEqual(f.state.closes, [false]);
  } finally {
    await f.dispose();
  }
});

test("natural EOF requires explicit restart confirmation; cancel preserves playback and menu", async () => {
  const f = await fixture({ ...last, completed: true });
  try {
    await f.click(f.action());
    assert.equal(f.calls.length, 0);
    assert.equal(document.activeElement?.hasAttribute("data-context-cancel"), true);
    await f.click("[data-context-cancel]");
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.state.closes, []);
    assert.equal(document.activeElement, f.action());
    await f.click(f.action());
    assert.match(document.querySelector(".context-menu-confirmation")!.textContent!, /same video/);
    await f.click("[data-context-confirm]");
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].target.id, last.id);
    assert.deepEqual(f.calls[0].options, { restart: true });
    assert.deepEqual(f.state.closes, [false]);
  } finally {
    await f.dispose();
  }
});

test("pending state disables activation and the shared runner rejects duplicate invocation", async () => {
  const f = await fixture();
  try {
    f.state.pending = true;
    await f.render();
    assert.equal(f.action().disabled, true);
    await f.click(f.action());
    assert.equal(f.calls.length, 0);
    f.state.pending = false;
    let release!: () => void;
    f.state.run = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    await f.render();
    await f.click(f.action());
    await f.click(f.action());
    assert.equal(f.calls.length, 1);
    assert.equal(f.action().getAttribute("aria-busy"), "true");
    assert.deepEqual(f.state.closes, []);
    await React.act(async () => release());
    assert.deepEqual(f.state.closes, [false]);
  } finally {
    await f.dispose();
  }
});

test("missing, loading and broken artwork retain the real SVG fallback without changing the command", async () => {
  const f = await fixture({
    ...last,
    src: { ...last.src, meta: { ...last.src.meta, poster: undefined } },
  });
  try {
    assert.ok(f.action().querySelector(".context-menu-icon svg"));
    assert.equal(f.action().querySelector("img"), null);
    f.state.target = last;
    await f.render();
    assert.ok(
      f.action().querySelector(".context-menu-icon svg"),
      "fallback remains while image is loading",
    );
    const image = f.action().querySelector("img")!;
    await React.act(async () => image.dispatchEvent(new f.dom.window.Event("load")));
    assert.equal(f.action().querySelector(".context-menu-icon svg"), null);
    await React.act(async () => image.dispatchEvent(new f.dom.window.Event("error")));
    assert.equal(f.action().querySelector("img"), null);
    assert.ok(f.action().querySelector(".context-menu-icon svg"));
    assert.equal(f.action().textContent?.trim(), "Continue last watched");
  } finally {
    await f.dispose();
  }
});

test("spoiler-hidden episode image and title never enter the row or its focused tooltip", async () => {
  const f = await fixture({
    ...last,
    src: {
      ...last.src,
      meta: { ...last.src.meta, type: "series", name: "Series A" },
      episode: {
        season: 2,
        episode: 3,
        name: "Secret reveal",
        still: "https://fixture.invalid/spoiler.jpg",
      },
    },
  });
  try {
    assert.equal(f.action().querySelector("img"), null);
    assert.ok(f.action().querySelector("svg"));
    await React.act(async () => {
      focusMenuCommand(f.action());
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    const tooltip = document.querySelector("[role='tooltip']");
    assert.ok(tooltip);
    assert.equal(tooltip.textContent, "Series A · S2 · E3");
    assert.equal(document.body.textContent!.includes("Secret reveal"), false);
    assert.equal(document.body.innerHTML.includes("spoiler.jpg"), false);
    assert.equal(document.body.innerHTML.includes("C:/synthetic"), false);
  } finally {
    await f.dispose();
  }
});

test("standalone last-playback row preserves A and explicit EOF restart without a quick cell", async () => {
  const f = await fixture({ ...last, completed: true });
  try {
    await f.render();
    assert.equal(f.action().textContent?.trim(), "Continue last watched");
    assert.equal(document.querySelectorAll("[data-context-action]").length, 1);
    assert.equal(document.querySelectorAll("[role=separator]").length, 0);
    assert.equal(f.action().closest("[data-context-quick]"), null);
    await f.click(f.action());
    assert.equal(f.calls.length, 0);
    await f.click("[data-context-cancel]");
    assert.equal(f.calls.length, 0);
    await f.click(f.action());
    await f.click("[data-context-confirm]");
    assert.equal(f.calls[0].target.id, last.id);
    assert.equal(f.calls[0].options.restart, true);
    f.state.enabled = false;
    await f.render();
    assert.equal(document.querySelectorAll("[data-context-action]").length, 0);
  } finally {
    await f.dispose();
  }
});
