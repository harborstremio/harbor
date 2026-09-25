import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { applyLinear, deltaFn } from "../src/lib/subtitles/text-sync.ts";

test("Live sync reopens its existing dialog and Escape respects the context menu above it", async () => {
  const dom = new JSDOM("<!doctype html><button id='origin'>Origin</button><div id='app'></div>");
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const deps: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": Object.fromEntries(
      ["Check", "Loader2", "RotateCcw", "Scissors", "X"].map((name) => [name, () => null]),
    ),
    "@/components/icons/search-icon": { Search: () => null },
    "@/lib/subtitles/parser": { findActiveCue: () => null },
    "@/lib/subtitles/text-sync": { applyLinear, deltaFn },
    "@/lib/player/playback-clock": { usePlaybackPosition: () => 0 },
    "@/lib/i18n": { useT: () => (text: string) => text },
    "./text-sync-list": { TextSyncList: () => null },
  };
  const code = ts.transpileModule(
    readFileSync(new URL("../src/views/player/text-sync-overlay.tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const output: any = {};
  new Function("require", "exports", code)((id: string) => {
    if (!(id in deps)) throw new Error(id);
    return deps[id];
  }, output);
  let discarded = 0;
  let focusRevision = 0;
  const root = createRoot(document.querySelector("#app")!);
  const render = () =>
    React.act(async () =>
      root.render(
        React.createElement(output.TextSyncOverlay, {
          api: {
            syncMode: "loading",
            cues: null,
            points: [],
            nudge: 0,
            segments: [],
            focusRevision,
            discard: () => {
              discarded++;
            },
          },
          playing: false,
          onPlayPause() {},
        }),
      ),
    );
  try {
    await render();
    document.querySelector<HTMLButtonElement>("#origin")!.focus();
    focusRevision++;
    await render();
    assert.equal(document.activeElement, document.querySelector("[data-player-live-sync]"));
    const menu = document.createElement("div");
    menu.setAttribute("data-harbor-context-layer", "");
    menu.setAttribute("data-menu-phase", "open");
    document.body.append(menu);
    const escape = () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    await React.act(async () => {
      escape();
    });
    assert.equal(discarded, 0);
    menu.remove();
    await React.act(async () => {
      escape();
    });
    assert.equal(discarded, 1);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
  }
});
